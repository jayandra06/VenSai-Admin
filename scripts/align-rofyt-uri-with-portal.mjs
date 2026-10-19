/**
 * Point Rofyt venture admin DB at the same Atlas cluster as the portal (database rofyt_admin).
 * Does not modify customer URI pools. Run: node scripts/align-rofyt-uri-with-portal.mjs
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

function adminUriFromPortal(portalUri, adminDb = "rofyt_admin") {
  const [pathPart, query] = portalUri.split("?");
  const slash = pathPart.lastIndexOf("/");
  const hostPart =
    slash > pathPart.indexOf("://") + 2 ? pathPart.slice(0, slash) : pathPart.replace(/\/$/, "");
  const qs = query ? `?${query}` : "?retryWrites=true&w=majority";
  return `${hostPart}/${adminDb}${qs}`;
}

const portalUri = loadPortalUri();
const adminUri = adminUriFromPortal(portalUri);
const client = new MongoClient(portalUri);
await client.connect();
const db = client.db("vensai");
const doc = await db.collection("ventures").findOne({ slug: "rofyt" });
if (!doc) {
  console.log("No rofyt venture document yet.");
  await client.close();
  process.exit(0);
}

const env = Array.isArray(doc.env) ? doc.env.filter((r) => r.key !== "MONGODB_URI") : [];
const upsert = (key, value) => {
  const i = env.findIndex((r) => r.key === key);
  if (i >= 0) env[i] = { key, value };
  else env.push({ key, value });
};
upsert("ADMIN_MONGODB_URI", adminUri);
upsert("ADMIN_DB", "rofyt_admin");

await db.collection("ventures").updateOne(
  { slug: "rofyt" },
  {
    $set: {
      env,
      adminDatabase: {
        uri: adminUri,
        database: "rofyt_admin",
        host: adminUri.split("@")[1]?.split("/")[0] ?? "",
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  },
);
console.log("Set ADMIN_MONGODB_URI to:");
console.log(adminUri.replace(/:([^:@/]+)@/, ":***@"));
await client.close();
