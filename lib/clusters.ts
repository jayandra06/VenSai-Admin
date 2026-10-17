import { describeMongoUri } from "@/lib/env";
import type { Venture, VenturePool } from "@/lib/ventures";

export function platformDatabaseFromEnv(env: { key: string; value: string }[]) {
  const uri = env.find((row) => row.key === "MONGODB_URI")?.value.trim() || "";
  const target = uri ? describeMongoUri(uri) : null;
  return { uri, database: target?.database || "rofyt" };
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

export function nextCustomerClusterIndex(pool: VenturePool) {
  const indices = poolIndices(pool);
  if (!indices.includes(0)) return null;
  const max = indices.length ? Math.max(...indices) : 0;
  const next = max + 1;
  if (next >= pool.freeLimit) return null;
  return next;
}

export function poolHasCapacity(pool: VenturePool) {
  return pool.clusters.length < pool.freeLimit && nextCustomerClusterIndex(pool) !== null;
}

export function pickPoolWithCapacity(venture: Venture) {
  return venture.pools.find((pool) => poolHasCapacity(pool)) ?? null;
}

export function normalizeUriHost(uri: string) {
  try {
    return new URL(uri).host;
  } catch {
    return "";
  }
}

export function poolMatchesPlatformUri(poolUri: string, platformUri: string) {
  if (!poolUri || !platformUri) return false;
  return normalizeUriHost(poolUri) === normalizeUriHost(platformUri);
}
