import {
  customerDatabaseName,
  nextCustomerClusterIndex,
  pickPoolWithCapacity,
} from "@/lib/clusters";
import { hashPassword, generateTempPassword } from "@/lib/password";
import { sendOrganizationInvite } from "@/lib/mail";
import { ensureVentureMongoPools } from "@/lib/platform-cluster";
import { getVenture, pingMongo, type Venture, type VentureCluster, type VenturePool } from "@/lib/ventures";
import { getDb } from "@/lib/db";
import { MongoClient, type Db } from "mongodb";

async function withClient<T>(uri: string, run: (client: MongoClient) => Promise<T>) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    return await run(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function resolvePoolUri(_venture: Venture, pool: VenturePool) {
  return pool.uri;
}

async function ensureCollection(db: Db, name: string) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (!exists) await db.createCollection(name);
}

function isDuplicateKeyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /E11000|duplicate key/i.test(message);
}

function mapProvisionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed out|Server selection|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return "provision-offline" as const;
  }
  if (/authentication failed|bad auth|Unauthorized|Authentication/i.test(message)) {
    return "provision-auth" as const;
  }
  if (/email-in-use:(\S+)/i.test(message)) {
    return "org-email-taken" as const;
  }
  if (/E11000|duplicate key/i.test(message)) {
    return "org-email-taken" as const;
  }
  return "provision-failed" as const;
}

async function provisionTenantDatabase(
  uri: string,
  database: string,
  slug: string,
  orgCode: string,
  clusterIndex: number,
  input: { organizationName: string; adminEmail: string; phone: string },
  passwordFields: { passwordHash: string; passwordSalt: string; passwordAlgo: string },
) {
  const email = input.adminEmail.trim().toLowerCase();

  await withClient(uri, async (client) => {
    const db = client.db(database);
    await db.command({ ping: 1 });

    await db.collection("organization").createIndex({ orgCode: 1 }, { unique: true });
    await db.collection("admins").createIndex({ email: 1 }, { unique: true });

    try {
      await db.collection("organization").insertOne({
        orgCode,
        clusterId: clusterIndex,
        name: input.organizationName.trim(),
        phone: input.phone.trim(),
        adminEmail: email,
        venture: slug,
        createdAt: new Date(),
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await db.collection("organization").findOne({ orgCode });
      if (!existing) throw error;
    }

    const existingAdmin = await db.collection("admins").findOne({ email });
    if (existingAdmin && String(existingAdmin.orgCode) !== orgCode) {
      const err = new Error(`email-in-use:${database}`);
      throw err;
    }
    if (existingAdmin) {
      await db.collection("admins").updateOne(
        { email },
        {
          $set: {
            role: "org_admin",
            orgCode,
            clusterId: clusterIndex,
            phone: input.phone.trim(),
            ...passwordFields,
            mustChangePassword: true,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      try {
        await db.collection("admins").insertOne({
          email,
          role: "org_admin",
          orgCode,
          clusterId: clusterIndex,
          phone: input.phone.trim(),
          ...passwordFields,
          mustChangePassword: true,
          createdAt: new Date(),
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        throw new Error(`email-in-use:${database}`);
      }
    }

    await ensureCollection(db, "fleets");
    await ensureCollection(db, "vehicles");
    await ensureCollection(db, "locations");
  });
}

export async function inviteOrganization(
  slug: string,
  input: { organizationName: string; adminEmail: string; phone: string },
  loginUrl: string,
) {
  await ensureVentureMongoPools(slug);
  const venture = await getVenture(slug);
  if (!venture) return "missing" as const;
  if (!venture.pools.length) return "no-pool" as const;
  const pool = pickPoolWithCapacity(venture);
  if (!pool) return "no-capacity" as const;

  const clusterIndex = nextCustomerClusterIndex(pool);
  if (clusterIndex === null) return "no-capacity" as const;

  const orgCode = String(clusterIndex);
  const database = customerDatabaseName(clusterIndex);
  const uri = resolvePoolUri(venture, pool);

  const online = await pingMongo(uri);
  if (!online) return "provision-offline" as const;

  const tempPassword = generateTempPassword();
  const { passwordHash, passwordSalt, passwordAlgo } = hashPassword(tempPassword);

  try {
    await provisionTenantDatabase(uri, database, slug, orgCode, clusterIndex, input, {
      passwordHash,
      passwordSalt,
      passwordAlgo,
    });
  } catch (error) {
    console.error("[inviteOrganization] provision failed", database, error);
    return mapProvisionError(error);
  }

  const mail = await sendOrganizationInvite({
    ventureName: venture.name,
    to: input.adminEmail.trim(),
    orgName: input.organizationName.trim(),
    orgCode,
    email: input.adminEmail.trim().toLowerCase(),
    password: tempPassword,
    loginUrl: loginUrl || "http://localhost:3001/erp/login",
  });

  const central = await getDb();
  const alreadyListed = pool.clusters.some((c) => c.orgCode === orgCode || c.id === orgCode);
  if (!alreadyListed) {
    await central.collection("ventures").updateOne(
      { slug, "pools.id": pool.id },
      {
        $push: {
          "pools.$.clusters": {
            id: orgCode,
            orgCode,
            organizationName: input.organizationName.trim(),
            adminEmail: input.adminEmail.trim().toLowerCase(),
            phone: input.phone.trim(),
            database,
            createdAt: new Date(),
            emailSentAt: mail.sent ? new Date().toISOString() : null,
          },
        },
      } as never,
    );
  }

  return mail.sent ? ("invited" as const) : ("invited-no-mail" as const);
}

export type OrganizationRow = VentureCluster & { poolLabel: string; poolId: string };

export function listOrganizations(venture: Venture): OrganizationRow[] {
  const rows = venture.pools.flatMap((pool) =>
    pool.clusters
      .filter((cluster) => cluster.orgCode !== "0" && cluster.id !== "0")
      .map((cluster) => ({
        ...cluster,
        poolLabel: pool.label,
        poolId: pool.id,
      })),
  );
  return rows.sort((a, b) => Number(a.orgCode || a.id) - Number(b.orgCode || b.id));
}

export function listPlatformClusters(venture: Venture) {
  return venture.pools.flatMap((pool) =>
    pool.clusters
      .filter((cluster) => cluster.orgCode === "0" || cluster.id === "0")
      .map((cluster) => ({ ...cluster, poolLabel: pool.label, poolId: pool.id })),
  );
}
