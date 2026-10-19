import {
  DEFAULT_POOL_LIMIT,
  platformDatabaseFromEnv,
  poolMatchesPlatformUri,
} from "@/lib/clusters";
import { mongoUriDisplayHost } from "@/lib/env";
import { addPool, getVenture, isMongoUri } from "@/lib/ventures";
import { getDb } from "@/lib/db";

/** Cluster 0 = database named in venture MONGODB_URI (Rofyt platform). */
async function ensureDefaultPoolFromEnv(slug: string) {
  const venture = await getVenture(slug);
  if (!venture) return;
  const { uri: platformUri } = platformDatabaseFromEnv(venture.env);
  if (!platformUri || !isMongoUri(platformUri)) return;

  const central = await getDb();
  const existing = venture.pools.find((item) => poolMatchesPlatformUri(item.uri, platformUri));

  if (existing) {
    if (existing.uri !== platformUri) {
      await central.collection("ventures").updateOne(
        { slug, "pools.id": existing.id },
        { $set: { "pools.$.uri": platformUri } },
      );
    }
    return;
  }

  const host = mongoUriDisplayHost(platformUri);
  const label = host ? `Project .env (${host})` : "Project .env";
  await addPool(slug, label, platformUri, DEFAULT_POOL_LIMIT);
}

export async function ensurePlatformCluster(slug: string) {
  const venture = await getVenture(slug);
  if (!venture) return;
  const { uri: platformUri, database } = platformDatabaseFromEnv(venture.env);
  if (!platformUri) return;

  const pool = venture.pools.find((item) => poolMatchesPlatformUri(item.uri, platformUri));
  if (!pool) return;
  if (pool.clusters.some((c) => c.orgCode === "0" || c.id === "0")) return;

  const central = await getDb();
  await central.collection("ventures").updateOne(
    { slug, "pools.id": pool.id },
    {
      $push: {
        "pools.$.clusters": {
          id: "0",
          orgCode: "0",
          organizationName: "Rofyt platform",
          adminEmail: "",
          phone: "",
          database,
          isPlatform: true,
          createdAt: new Date(),
          emailSentAt: null,
        },
      },
    } as never,
  );
}

async function reorderPlatformPoolFirst(slug: string) {
  const venture = await getVenture(slug);
  if (!venture) return;
  const { uri: platformUri } = platformDatabaseFromEnv(venture.env);
  if (!platformUri) return;
  const platformPool = venture.pools.find((item) => poolMatchesPlatformUri(item.uri, platformUri));
  if (!platformPool || venture.pools[0]?.id === platformPool.id) return;
  const others = venture.pools.filter((item) => item.id !== platformPool.id);
  const central = await getDb();
  await central.collection("ventures").updateOne({ slug }, { $set: { pools: [platformPool, ...others] } });
}

/** Drop empty URI pools that no longer match the saved project .env (stale hosts). */
async function pruneStaleEmptyPools(slug: string) {
  const venture = await getVenture(slug);
  if (!venture) return;
  const { uri: platformUri } = platformDatabaseFromEnv(venture.env);
  if (!platformUri) return;
  const stale = venture.pools.filter(
    (pool) => !poolMatchesPlatformUri(pool.uri, platformUri) && pool.clusters.length === 0,
  );
  if (!stale.length) return;
  const central = await getDb();
  for (const pool of stale) {
    await central.collection("ventures").updateOne({ slug }, { $pull: { pools: { id: pool.id } } } as never);
  }
}

/** Sync project .env URI into pools and reserve cluster 0 for the platform DB. */
export async function ensureVentureMongoPools(slug: string) {
  await ensureDefaultPoolFromEnv(slug);
  await pruneStaleEmptyPools(slug);
  await reorderPlatformPoolFirst(slug);
  await ensurePlatformCluster(slug);
}
