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

export function describeMongoUri(uri: string) {
  try {
    const parsed = new URL(uri);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "rofyt";
    return { host: parsed.host, database };
  } catch {
    return null;
  }
}
