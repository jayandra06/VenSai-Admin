import { platformDatabaseFromEnv } from "@/lib/clusters";
import { formatEnv, type EnvPair } from "@/lib/env";

export type VentureAdminDatabase = {
  uri: string;
  database: string;
  host: string;
  updatedAt: string;
};

export function buildAdminDatabaseFromEnv(env: EnvPair[]): VentureAdminDatabase | null {
  const { uri, database } = platformDatabaseFromEnv(env);
  if (!uri.trim()) return null;
  const host = uri.includes("@") ? uri.split("@")[1]?.split("/")[0]?.split("?")[0] ?? "" : "";
  return {
    uri: uri.trim(),
    database: database.trim() || "rofyt",
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

/** Merge deploy URLs into venture .env for copy/paste to Vercel. */
export function mergeDeployEnv(input: {
  env: EnvPair[];
  clientPortalUrl: string;
  adminPortalUrl: string;
}) {
  let env = [...input.env];
  env = upsertEnvKey(env, "APP_URL", input.clientPortalUrl);
  env = upsertEnvKey(env, "CLIENT_PORTAL_URL", input.clientPortalUrl);
  env = upsertEnvKey(env, "ADMIN_APP_URL", input.adminPortalUrl);
  env = upsertEnvKey(env, "PLATFORM_DB", platformDatabaseFromEnv(env).database);
  return env;
}

export function formatDeployEnvFile(env: EnvPair[]) {
  return formatEnv(env);
}
