import { mongoUriDatabase, mongoUriHostKey } from "@/lib/env";
import type { Venture, VenturePool } from "@/lib/ventures";

export const DEFAULT_POOL_LIMIT = 700;

export function platformDatabaseFromEnv(env: { key: string; value: string }[]) {
  const uri = env.find((row) => row.key === "MONGODB_URI")?.value.trim() || "";
  const platformDb = env.find((row) => row.key === "PLATFORM_DB")?.value.trim() || "";
  const database = platformDb || (uri ? mongoUriDatabase(uri) : "rofyt");
  return { uri, database };
}

export function customerDatabaseName(clusterIndex: number) {
  return `rofyt-${clusterIndex}`;
}

export function clusterIndexOf(cluster: { orgCode?: string; id: string }) {
  const raw = cluster.orgCode || cluster.id;
  const num = Number(raw);
  return Number.isInteger(num) && num >= 0 ? num : null;
}

export function poolIndices(pool: VenturePool) {
  return pool.clusters.map((item) => clusterIndexOf(item)).filter((n): n is number => n !== null);
}

export function nextCustomerClusterIndex(pool: VenturePool, isPlatformPool: boolean) {
  const indices = poolIndices(pool);
  if (isPlatformPool) {
    if (!indices.includes(0)) return null;
    const max = indices.length ? Math.max(...indices) : 0;
    const next = max + 1;
    if (next >= pool.freeLimit) return null;
    return next;
  }
  const customer = indices.filter((n) => n >= 1);
  const next = customer.length ? Math.max(...customer) + 1 : 1;
  if (next >= pool.freeLimit) return null;
  return next;
}

export function poolHasCapacity(pool: VenturePool, isPlatformPool: boolean) {
  return pool.clusters.length < pool.freeLimit && nextCustomerClusterIndex(pool, isPlatformPool) !== null;
}

export function poolIsPlatformPool(pool: VenturePool, venture: Venture) {
  const { uri: platformUri } = platformDatabaseFromEnv(venture.env);
  return Boolean(platformUri && poolMatchesPlatformUri(pool.uri, platformUri));
}

export function pickPoolWithCapacity(venture: Venture) {
  const ordered = [...venture.pools].sort((a, b) => {
    const aPlatform = poolIsPlatformPool(a, venture) ? 0 : 1;
    const bPlatform = poolIsPlatformPool(b, venture) ? 0 : 1;
    return aPlatform - bPlatform;
  });
  return (
    ordered.find((pool) => poolHasCapacity(pool, poolIsPlatformPool(pool, venture))) ?? null
  );
}

export function normalizeUriHost(uri: string) {
  return mongoUriHostKey(uri);
}

export function poolMatchesPlatformUri(poolUri: string, platformUri: string) {
  if (!poolUri || !platformUri) return false;
  const a = mongoUriHostKey(poolUri);
  const b = mongoUriHostKey(platformUri);
  return Boolean(a && b && a === b);
}
