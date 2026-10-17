export type EnvPair = { key: string; value: string };

export function parseEnv(raw: string): EnvPair[] {
  const rows: EnvPair[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const body = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    rows.push({ key, value });
  }
  return rows;
}

function formatValue(value: string) {
  if (/[\s#"'`]/.test(value)) return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return value;
}

export function formatEnv(rows: EnvPair[]) {
  return rows
    .filter((row) => row.key.trim())
    .map((row) => `${row.key.trim()}=${formatValue(row.value)}`)
    .join("\n");
}

function mongoUriBody(uri: string) {
  const withoutQuery = uri.split("?")[0] ?? uri;
  const schemeEnd = withoutQuery.indexOf("://");
  if (schemeEnd === -1) return "";
  return withoutQuery.slice(schemeEnd + 3);
}

/** Host key for matching pools (sorted hostnames, ignores ports). */
export function mongoUriHostKey(uri: string) {
  const body = mongoUriBody(uri);
  if (!body) return "";
  const hostSection = body.includes("@") ? body.slice(body.indexOf("@") + 1) : body;
  const hostPart = hostSection.split("/")[0] ?? "";
  return hostPart
    .split(",")
    .map((entry) => entry.split(":")[0]?.trim().toLowerCase() ?? "")
    .filter(Boolean)
    .sort()
    .join(",");
}

export function mongoUriDatabase(uri: string, fallback = "rofyt") {
  const body = mongoUriBody(uri);
  if (!body) return fallback;
  const hostSection = body.includes("@") ? body.slice(body.indexOf("@") + 1) : body;
  const slash = hostSection.indexOf("/");
  if (slash === -1) return fallback;
  const name = decodeURIComponent(hostSection.slice(slash + 1).trim());
  return name || fallback;
}

export function mongoUriDisplayHost(uri: string) {
  const key = mongoUriHostKey(uri);
  if (!key) return "";
  return key.split(",")[0] ?? key;
}

export function describeMongoUri(uri: string) {
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) return null;
  return {
    host: mongoUriDisplayHost(uri),
    database: mongoUriDatabase(uri),
  };
}
