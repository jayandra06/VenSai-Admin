/**
 * One-time: point Rofyt venture MONGODB_URI at the same Atlas cluster as the portal,
 * database `rofyt`. Run from repo root: node scripts/align-rofyt-uri-with-portal.mjs
 */
import fs from "node:fs";
import { MongoClient } from "mongodb";

function loadPortalUri() {
  const raw = fs.readFileSync(".env.local", "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith("MONGODB_URI="));
  if (!line) throw new Error("MONGODB_URI missing in .env.local");
  let uri = line.slice("MONGODB_URI=".length).trim();
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1);
  }
  return uri;
}

function rofytUriFromPortal(portalUri) {
  const [pathPart, query] = portalUri.split("?");
  const slash = pathPart.lastIndexOf("/");
  const hostPart =
    slash > pathPart.indexOf("://") + 2 ? pathPart.slice(0, slash) : pathPart.replace(/\/$/, "");
  const qs = query ? `?${query}` : "?retryWrites=true&w=majority";
  return `${hostPart}/rofyt${qs}`;
}

const portalUri = loadPortalUri();
const rofytUri = rofytUriFromPortal(portalUri);
const client = new MongoClient(portalUri);
await client.connect();
const db = client.db("vensai");
const doc = await db.collection("ventures").findOne({ slug: "rofyt" });
if (!doc) {
  console.log("No rofyt venture document yet — nothing to update.");
  await client.close();
  process.exit(0);
}

const env = Array.isArray(doc.env) ? [...doc.env] : [];
const idx = env.findIndex((r) => r.key === "MONGODB_URI");
if (idx >= 0) env[idx] = { ...env[idx], value: rofytUri };
else env.push({ key: "MONGODB_URI", value: rofytUri });
if (!env.some((r) => r.key === "PLATFORM_DB")) env.push({ key: "PLATFORM_DB", value: "rofyt" });

const pools = Array.isArray(doc.pools) ? doc.pools.map((p) => ({ ...p, uri: rofytUri })) : [];

await db.collection("ventures").updateOne(
  { slug: "rofyt" },
  { $set: { env, pools, updatedAt: new Date() } },
);
console.log("Updated rofyt venture MONGODB_URI and all pool URIs to:");
console.log(rofytUri.replace(/:([^:@/]+)@/, ":***@"));
await client.close();
