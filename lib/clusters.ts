import { mongoUriDatabase, mongoUriHostKey } from "@/lib/env";
import type { Venture, VenturePool } from "@/lib/ventures";

export const DEFAULT_POOL_LIMIT = 700;

/**
 * Venture admin portal database (Rofyt /admin app). Stored in central vensai — not a customer pool.
 */
export function ventureAdminDatabaseFromEnv(env: { key: string; value: string }[]) {
  const uri =
    env.find((row) => row.key === "ADMIN_MONGODB_URI")?.value.trim() ||
    env.find((row) => row.key === "MONGODB_URI")?.value.trim() ||
    "";
  const database =
    env.find((row) => row.key === "ADMIN_DB")?.value.trim() ||
    env.find((row) => row.key === "PLATFORM_DB")?.value.trim() ||
    (uri ? mongoUriDatabase(uri) : "") ||
    "rofyt_admin";
  return { uri, database };
}

/** @deprecated use ventureAdminDatabaseFromEnv */
export const platformDatabaseFromEnv = ventureAdminDatabaseFromEnv;

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

/** Next customer slot on this URI pool (1 … freeLimit−1). Admin DB is separate — not cluster 0 here. */
export function nextCustomerClusterIndex(pool: VenturePool) {
  const customer = poolIndices(pool).filter((n) => n >= 1);
  const next = customer.length ? Math.max(...customer) + 1 : 1;
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
  return mongoUriHostKey(uri);
}

export function poolMatchesPlatformUri(poolUri: string, platformUri: string) {
  if (!poolUri || !platformUri) return false;
  const a = mongoUriHostKey(poolUri);
  const b = mongoUriHostKey(platformUri);
  return Boolean(a && b && a === b);
}
