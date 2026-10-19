import { ventureAdminDatabaseFromEnv } from "@/lib/clusters";
import { formatEnv, type EnvPair } from "@/lib/env";

export type VentureAdminDatabase = {
  uri: string;
  database: string;
  host: string;
  updatedAt: string;
};

export function buildAdminDatabaseFromEnv(env: EnvPair[]): VentureAdminDatabase | null {
  const { uri, database } = ventureAdminDatabaseFromEnv(env);
  if (!uri.trim()) return null;
  const host = uri.includes("@") ? uri.split("@")[1]?.split("/")[0]?.split("?")[0] ?? "" : "";
  return {
    uri: uri.trim(),
    database: database.trim() || "rofyt_admin",
    host,
    updatedAt: new Date().toISOString(),
  };
}

function upsertEnvKey(env: EnvPair[], key: string, value: string): EnvPair[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return env.filter((row) => row.key !== key);
  }
  const next = env.filter((row) => row.key !== key);
  next.push({ key, value: trimmed });
  return next.sort((a, b) => a.key.localeCompare(b.key));
}

/** Full venture .env stored in vensai (includes admin + shared keys). */
export function mergeDeployEnv(input: {
  env: EnvPair[];
  clientPortalUrl: string;
  adminPortalUrl: string;
}) {
  let env = [...input.env];
  const admin = ventureAdminDatabaseFromEnv(env);
  env = upsertEnvKey(env, "APP_URL", input.clientPortalUrl);
  env = upsertEnvKey(env, "CLIENT_PORTAL_URL", input.clientPortalUrl);
  env = upsertEnvKey(env, "ADMIN_APP_URL", input.adminPortalUrl);
  env = upsertEnvKey(env, "ADMIN_MONGODB_URI", admin.uri);
  env = upsertEnvKey(env, "ADMIN_DB", admin.database);
  return env;
}

/** Copy into Vercel project for admin-rofyt.* (platform owner app). */
export function mergeAdminAppDeployEnv(input: {
  env: EnvPair[];
  adminPortalUrl: string;
}) {
  const admin = ventureAdminDatabaseFromEnv(input.env);
  const rows: EnvPair[] = [
    { key: "MONGODB_URI", value: admin.uri },
    { key: "ADMIN_MONGODB_URI", value: admin.uri },
    { key: "ADMIN_DB", value: admin.database },
    { key: "PLATFORM_DB", value: admin.database },
    { key: "APP_URL", value: input.adminPortalUrl.trim() },
    { key: "ADMIN_APP_URL", value: input.adminPortalUrl.trim() },
  ];
  return rows.filter((r) => r.value.trim());
}

/** Copy into Vercel project for rofyt.* (customer ERP). Uses first customer pool URI when set. */
export function mergeErpAppDeployEnv(input: {
  env: EnvPair[];
  clientPortalUrl: string;
  firstCustomerPoolUri?: string;
}) {
  const poolUri = input.firstCustomerPoolUri?.trim() || "";
  const rows: EnvPair[] = [
    { key: "MONGODB_URI", value: poolUri },
    { key: "APP_URL", value: input.clientPortalUrl.trim() },
    { key: "CLIENT_PORTAL_URL", value: input.clientPortalUrl.trim() },
  ];
  return rows.filter((r) => r.value.trim());
}

export function formatDeployEnvFile(env: EnvPair[]) {
  return formatEnv(env);
}
