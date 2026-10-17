import {
  customerDatabaseName,
  nextCustomerClusterIndex,
  pickPoolWithCapacity,
  poolIsPlatformPool,
} from "@/lib/clusters";
import { hashPassword, generateTempPassword } from "@/lib/password";
import { sendOrganizationInvite } from "@/lib/mail";
import { ensureVentureMongoPools } from "@/lib/platform-cluster";
import { getVenture, type Venture, type VentureCluster } from "@/lib/ventures";
import { getDb } from "@/lib/db";
import { MongoClient } from "mongodb";

async function withClient<T>(uri: string, run: (client: MongoClient) => Promise<T>) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    return await run(client);
  } finally {
    await client.close().catch(() => undefined);
  }
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

  const clusterIndex = nextCustomerClusterIndex(pool, poolIsPlatformPool(pool, venture));
  if (clusterIndex === null) return "no-capacity" as const;

  const orgCode = String(clusterIndex);
  const database = customerDatabaseName(clusterIndex);
  const tempPassword = generateTempPassword();
  const { passwordHash, passwordSalt, passwordAlgo } = hashPassword(tempPassword);

  try {
    await withClient(pool.uri, async (client) => {
      const db = client.db(database);
      await db.collection("organization").insertOne({
        orgCode,
        clusterId: clusterIndex,
        name: input.organizationName.trim(),
        phone: input.phone.trim(),
        adminEmail: input.adminEmail.trim().toLowerCase(),
        venture: slug,
        createdAt: new Date(),
      });
      await db.collection("admins").createIndex({ email: 1 }, { unique: true });
      await db.collection("admins").insertOne({
        email: input.adminEmail.trim().toLowerCase(),
        role: "org_admin",
        orgCode,
        clusterId: clusterIndex,
        phone: input.phone.trim(),
        passwordHash,
        passwordSalt,
        passwordAlgo,
        mustChangePassword: true,
        createdAt: new Date(),
      });
      await db.createCollection("fleets");
      await db.createCollection("vehicles");
      await db.createCollection("locations");
    });
  } catch {
    return "provision-failed" as const;
  }

  const mail = await sendOrganizationInvite({
    ventureName: venture.name,
    to: input.adminEmail.trim(),
    orgName: input.organizationName.trim(),
    orgCode,
    email: input.adminEmail.trim().toLowerCase(),
    password: tempPassword,
    loginUrl: loginUrl || "http://localhost:3001/login",
  });

  const central = await getDb();
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
