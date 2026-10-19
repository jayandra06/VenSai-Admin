import { mongoUriHostKey } from "@/lib/env";
import { getVenture } from "@/lib/ventures";
import { getDb } from "@/lib/db";

/** Remove extra empty pools that point at the same Atlas host. */
async function dedupeDuplicateHostPools(slug: string) {
  const venture = await getVenture(slug);
  if (!venture || venture.pools.length < 2) return;
  const byHost = new Map<string, typeof venture.pools>();
  for (const pool of venture.pools) {
    const key = mongoUriHostKey(pool.uri) || pool.id;
    const list = byHost.get(key) ?? [];
    list.push(pool);
    byHost.set(key, list);
  }
  const removeIds: string[] = [];
  for (const group of byHost.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => b.clusters.length - a.clusters.length);
    for (let i = 1; i < group.length; i++) {
      if (group[i].clusters.length === 0) removeIds.push(group[i].id);
    }
  }
  if (!removeIds.length) return;
  const central = await getDb();
  for (const id of removeIds) {
    await central.collection("ventures").updateOne({ slug }, { $pull: { pools: { id } } } as never);
  }
}

/** Strip legacy cluster-0 rows from pools (admin DB is not a pool slot). */
async function stripLegacyPlatformClustersFromPools(slug: string) {
  const venture = await getVenture(slug);
  if (!venture) return;
  const central = await getDb();
  for (const pool of venture.pools) {
    const legacy = pool.clusters.filter((c) => c.orgCode === "0" || c.id === "0");
    if (!legacy.length) continue;
    await central.collection("ventures").updateOne(
      { slug, "pools.id": pool.id },
      { $pull: { "pools.$.clusters": { orgCode: "0" } } } as never,
    );
    await central.collection("ventures").updateOne(
      { slug, "pools.id": pool.id },
      { $pull: { "pools.$.clusters": { id: "0" } } } as never,
    );
  }
}

/** Customer URI pools only — admin DB is configured separately in venture .env. */
export async function ensureVentureMongoPools(slug: string) {
  await stripLegacyPlatformClustersFromPools(slug);
  await dedupeDuplicateHostPools(slug);
}
