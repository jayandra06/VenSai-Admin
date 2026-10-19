import { MongoClient } from "mongodb";
import { getDb } from "@/lib/db";
import { describeMongoUri, type EnvPair } from "@/lib/env";
import { platformDatabaseFromEnv, poolMatchesPlatformUri } from "@/lib/clusters";
import { hashPassword } from "@/lib/password";
import {
  buildAdminDatabaseFromEnv,
  mergeDeployEnv,
  type VentureAdminDatabase,
} from "@/lib/venture-record";

export const VENTURES = [
  {
    slug: "rofyt",
    name: "Rofyt",
    summary: "Car rental platform. Each company gets its own database for fleet and locations.",
  },
] as const;

export type VentureCluster = {
  id: string;
  orgCode: string;
  organizationName: string;
  adminEmail: string;
  phone: string;
  database: string;
  createdAt: string;
  emailSentAt: string | null;
  /** @deprecated legacy manual clusters */
  company?: string;
};

export type VenturePool = {
  id: string;
  label: string;
  uri: string;
  freeLimit: number;
  clusters: VentureCluster[];
};

export type Venture = {
  slug: string;
  name: string;
  /** @deprecated use clientPortalUrl */
  deployedUrl: string;
  clientPortalUrl: string;
  adminPortalUrl: string;
  /** Venture platform DB (cluster 0) — stored in central vensai DB for seeding. */
  adminDatabase: VentureAdminDatabase | null;
  env: EnvPair[];
  adminEmail: string;
  adminPassword: string;
  pools: VenturePool[];
  lastSeed: { email: string; database: string; host: string; at: string } | null;
};

export function clusterCapacity(venture: Venture) {
  const limit = venture.pools.reduce((sum, pool) => sum + pool.freeLimit, 0);
  const used = venture.pools.reduce((sum, pool) => sum + pool.clusters.length, 0);
  return { used, limit, free: Math.max(0, limit - used) };
}

const PROTECTED = new Set(["admin", "local", "config", "vensai"]);

function blank(preset: (typeof VENTURES)[number]): Venture {
  return {
    slug: preset.slug,
    name: preset.name,
    deployedUrl: "",
    clientPortalUrl: "",
    adminPortalUrl: "",
    adminDatabase: null,
    env: [],
    adminEmail: "",
    adminPassword: "",
    pools: [],
    lastSeed: null,
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function mapVenture(preset: (typeof VENTURES)[number], doc: Record<string, unknown> | null): Venture {
  if (!doc) return blank(preset);
  const env = Array.isArray(doc.env)
    ? doc.env
        .map((row) => ({
          key: asString((row as EnvPair).key),
          value: asString((row as EnvPair).value),
        }))
        .filter((row) => row.key)
    : [];
  const pools = Array.isArray(doc.pools)
    ? doc.pools.map((pool) => {
        const item = pool as Record<string, unknown>;
        const clusters = Array.isArray(item.clusters)
          ? item.clusters.map((cluster) => {
              const row = cluster as Record<string, unknown>;
              const created = row.createdAt instanceof Date ? row.createdAt : new Date();
              const orgCode = asString(row.orgCode) || (/^\d{6}$/.test(asString(row.id)) ? asString(row.id) : "");
              const legacyName = asString(row.company);
              return {
                id: asString(row.id),
                orgCode,
                organizationName: asString(row.organizationName) || legacyName,
                adminEmail: asString(row.adminEmail),
                phone: asString(row.phone),
                database: asString(row.database),
                createdAt: created.toISOString(),
                emailSentAt: asString(row.emailSentAt) || null,
                company: legacyName || undefined,
              };
            })
          : [];
        return {
          id: asString(item.id),
          label: asString(item.label) || "MongoDB",
          uri: asString(item.uri),
          freeLimit: Number(item.freeLimit) || 700,
          clusters,
        };
      })
    : [];
  const seed = doc.lastSeed as Record<string, unknown> | null;
  const clientPortalUrl = asString(doc.clientPortalUrl) || asString(doc.deployedUrl);
  const adminPortalUrl = asString(doc.adminPortalUrl);
  const adminRaw = doc.adminDatabase as Record<string, unknown> | null;
  const adminDatabase =
    adminRaw && asString(adminRaw.uri)
      ? {
          uri: asString(adminRaw.uri),
          database: asString(adminRaw.database) || "rofyt",
          host: asString(adminRaw.host),
          updatedAt: asString(adminRaw.updatedAt),
        }
      : null;
  return {
    slug: preset.slug,
    name: asString(doc.name) || preset.name,
    deployedUrl: clientPortalUrl,
    clientPortalUrl,
    adminPortalUrl,
    adminDatabase,
    env,
    adminEmail: asString(doc.adminEmail),
    adminPassword: asString(doc.adminPassword),
    pools,
    lastSeed:
      seed && asString(seed.email)
        ? {
            email: asString(seed.email),
            database: asString(seed.database),
            host: asString(seed.host),
            at: asString(seed.at),
          }
        : null,
  };
}

export function findPreset(slug: string) {
  return VENTURES.find((item) => item.slug === slug) ?? null;
}

export async function listVentures() {
  const db = await getDb();
  const docs = await db
    .collection("ventures")
    .find({ slug: { $in: VENTURES.map((item) => item.slug) } })
    .toArray();
  return VENTURES.map((preset) => {
    const doc = docs.find((item) => item.slug === preset.slug) ?? null;
    const venture = mapVenture(preset, doc as Record<string, unknown> | null);
    const capacity = clusterCapacity(venture);
    const customerClusters = venture.pools.flatMap((pool) =>
      pool.clusters.filter((cluster) => cluster.orgCode !== "0" && cluster.id !== "0"),
    );
    const clusterIds = customerClusters
      .map((cluster) => cluster.orgCode || cluster.id)
      .sort((a, b) => Number(a) - Number(b));
    return {
      ...preset,
      uris: venture.pools.length,
      clusters: capacity.used,
      clusterLimit: capacity.limit,
      clusterFree: capacity.free,
      customers: customerClusters.length,
      clusterIds,
    };
  });
}

export async function getVenture(slug: string) {
  const preset = findPreset(slug);
  if (!preset) return null;
  const db = await getDb();
  const doc = await db.collection("ventures").findOne({ slug });
  return mapVenture(preset, doc as Record<string, unknown> | null);
}

async function ensureVenture(slug: string) {
  const preset = findPreset(slug);
  if (!preset) return null;
  const db = await getDb();
  await db.collection("ventures").updateOne(
    { slug },
    {
      $setOnInsert: {
        slug,
        name: preset.name,
        deployedUrl: "",
        env: [],
        adminEmail: "",
        adminPassword: "",
        pools: [],
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  return preset;
}

export function readSettings(formData: FormData) {
  const keys = formData.getAll("envKey").map((item) => String(item).trim());
  const values = formData.getAll("envValue").map((item) => String(item));
  const env = keys
    .map((key, index) => ({ key, value: values[index] ?? "" }))
    .filter((row) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(row.key));
  const clientPortalUrl = String(formData.get("clientPortalUrl") || formData.get("deployedUrl") || "").trim();
  const adminPortalUrl = String(formData.get("adminPortalUrl") || "").trim();
  const mergedEnv = mergeDeployEnv({ env, clientPortalUrl, adminPortalUrl });
  return {
    name: String(formData.get("name") || "").trim(),
    deployedUrl: clientPortalUrl,
    clientPortalUrl,
    adminPortalUrl,
    adminEmail: String(formData.get("adminEmail") || "").trim(),
    adminPassword: String(formData.get("adminPassword") || ""),
    env: mergedEnv,
  };
}

export async function saveSettings(slug: string, input: ReturnType<typeof readSettings>) {
  const preset = await ensureVenture(slug);
  if (!preset) return null;
  const current = await getVenture(slug);
  const db = await getDb();
  const adminDatabase = buildAdminDatabaseFromEnv(input.env);
  await db.collection("ventures").updateOne(
    { slug },
    {
      $set: {
        name: input.name || preset.name,
        deployedUrl: input.clientPortalUrl,
        clientPortalUrl: input.clientPortalUrl,
        adminPortalUrl: input.adminPortalUrl,
        adminDatabase,
        env: input.env,
        adminEmail: input.adminEmail,
        adminPassword: input.adminPassword || current?.adminPassword || "",
        updatedAt: new Date(),
      },
    },
  );
  return getVenture(slug);
}

export function isMongoUri(uri: string) {
  return /^mongodb(\+srv)?:\/\//.test(uri);
}

async function withClient<T>(uri: string, run: (client: MongoClient) => Promise<T>) {
  if (!isMongoUri(uri)) throw new Error("invalid-uri");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    return await run(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function pingMongo(uri: string) {
  try {
    await withClient(uri, (client) => client.db().command({ ping: 1 }));
    return true;
  } catch {
    return false;
  }
}

export async function seedAdminAccount(
  uri: string,
  email: string,
  password: string,
  databaseName?: string,
) {
  const target = describeMongoUri(uri);
  const database = databaseName || target?.database || "rofyt";
  if (PROTECTED.has(database)) throw new Error("protected-db");
  const hashed = hashPassword(password);
  await withClient(uri, async (client) => {
    const admins = client.db(database).collection("admins");
    await admins.createIndex({ email: 1 }, { unique: true });
    await admins.updateOne(
      { email },
      {
        $set: {
          email,
          role: "platform_admin",
          orgCode: "0",
          clusterId: 0,
          ...hashed,
          mustChangePassword: false,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  });
  return { database, host: target?.host || "" };
}

export async function rememberSeed(
  slug: string,
  seed: { email: string; database: string; host: string },
) {
  const db = await getDb();
  await db.collection("ventures").updateOne(
    { slug },
    { $set: { lastSeed: { ...seed, at: new Date().toISOString() } } },
  );
}

export async function addPool(slug: string, label: string, uri: string, freeLimit: number) {
  await ensureVenture(slug);
  const db = await getDb();
  const pool = {
    id: crypto.randomUUID(),
    label: label || "MongoDB",
    uri,
    freeLimit,
    clusters: [],
  };
  await db.collection("ventures").updateOne({ slug }, { $push: { pools: pool } } as never);
}

function companyDatabase(company: string) {
  const slug = company
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  if (!slug) return null;
  const database = `rofyt-${slug}`;
  if (PROTECTED.has(database) || database.length > 63) return null;
  return database;
}

export async function createCompanyCluster(slug: string, poolId: string, company: string) {
  const venture = await getVenture(slug);
  const pool = venture?.pools.find((item) => item.id === poolId);
  if (!venture || !pool) return "missing" as const;
  if (pool.clusters.length >= pool.freeLimit) return "limit" as const;
  const database = companyDatabase(company);
  if (!database) return "company" as const;
  if (
    pool.clusters.some(
      (item) =>
        item.database === database ||
        item.organizationName.toLowerCase() === company.toLowerCase() ||
        item.company?.toLowerCase() === company.toLowerCase(),
    )
  ) {
    return "duplicate" as const;
  }
  try {
    await withClient(pool.uri, async (client) => {
      const databaseRef = client.db(database);
      await databaseRef.collection("company").insertOne({
        name: company.trim(),
        venture: slug,
        createdAt: new Date(),
      });
      await databaseRef.createCollection("vehicles");
      await databaseRef.createCollection("locations");
    });
  } catch {
    return "failed" as const;
  }
  const db = await getDb();
  await db.collection("ventures").updateOne(
    { slug, "pools.id": poolId },
    {
      $push: {
        "pools.$.clusters": {
          id: crypto.randomUUID(),
          company: company.trim(),
          database,
          createdAt: new Date(),
        },
      },
    } as never,
  );
  return "ok" as const;
}

function removableDatabase(database: string) {
  if (PROTECTED.has(database)) return false;
  if (/^rofyt-\d+$/.test(database)) return true;
  return database.startsWith("rofyt-");
}

export async function removeCompanyCluster(slug: string, poolId: string, clusterId: string) {
  const venture = await getVenture(slug);
  const pool = venture?.pools.find((item) => item.id === poolId);
  const cluster = pool?.clusters.find((item) => item.id === clusterId);
  if (!pool || !cluster || cluster.orgCode === "0" || cluster.id === "0") {
    return false;
  }
  if (!removableDatabase(cluster.database)) {
    return false;
  }
  await withClient(pool.uri, (client) => client.db(cluster.database).dropDatabase());
  const db = await getDb();
  await db.collection("ventures").updateOne(
    { slug, "pools.id": poolId },
    { $pull: { "pools.$.clusters": { id: clusterId } } } as never,
  );
  return true;
}

export async function removePool(slug: string, poolId: string) {
  const venture = await getVenture(slug);
  const pool = venture?.pools.find((item) => item.id === poolId);
  if (!pool || pool.clusters.length > 0) return false;
  const { uri: platformUri } = platformDatabaseFromEnv(venture?.env ?? []);
  if (platformUri && poolMatchesPlatformUri(pool.uri, platformUri)) return false;
  const db = await getDb();
  await db.collection("ventures").updateOne({ slug }, { $pull: { pools: { id: poolId } } } as never);
  return true;
}
