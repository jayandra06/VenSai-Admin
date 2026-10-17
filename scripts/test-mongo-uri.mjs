import fs from "fs";
import { MongoClient } from "mongodb";

const file = process.argv[2] || ".env.vercel.check";
const env = fs.readFileSync(file, "utf8");
const m = env.match(/^MONGODB_URI="(.+)"$/m) || env.match(/^MONGODB_URI=(.+)$/m);
if (!m) {
  console.error("No MONGODB_URI in", file);
  process.exit(1);
}
const uri = m[1].replace(/^"|"$/g, "");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  await client.db("vensai").command({ ping: 1 });
  console.log("OK", file);
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
} finally {
  await client.close();
}
