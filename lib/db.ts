import { MongoClient, ObjectId, type Document } from "mongodb";

const uri = process.env.MONGODB_URI;
const globalForMongo = globalThis as unknown as { mongo?: Promise<MongoClient> };

export type PortalRecord = {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
};

function clientPromise() {
  if (!uri) throw new Error("MONGODB_URI is missing");
  if (!globalForMongo.mongo) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    globalForMongo.mongo = client.connect();
  }
  return globalForMongo.mongo;
}

export async function getDb() {
  const client = await clientPromise();
  return client.db("vensai");
}

function mapDoc(doc: Document & { _id: ObjectId }): PortalRecord {
  const created = doc.createdAt instanceof Date ? doc.createdAt : new Date();
  return {
    id: doc._id.toString(),
    title: String(doc.title ?? ""),
    category: String(doc.category ?? "General"),
    status: String(doc.status ?? "Open"),
    createdAt: created.toISOString(),
  };
}

export async function loadRecords(limit = 100) {
  const db = await getDb();
  await db.command({ ping: 1 });
  const col = db.collection("records");
  const [total, open, docs] = await Promise.all([
    col.countDocuments(),
    col.countDocuments({ status: { $ne: "Done" } }),
    col.find().sort({ createdAt: -1 }).limit(limit).toArray(),
  ]);
  return { ok: true as const, total, open, records: docs.map(mapDoc) };
}

function mongoErrorMessage(error: unknown) {
  if (!uri) {
    return "MONGODB_URI is not set on this server. In Vercel (or your host), add MONGODB_URI under Project → Settings → Environment Variables, then redeploy.";
  }
  const message = error instanceof Error ? error.message : "";
  if (/authentication failed|bad auth|Invalid credentials/i.test(message)) {
    return "MongoDB rejected the username or password. Update MONGODB_URI in your hosting environment.";
  }
  if (/timed out|Server selection|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return "Could not reach MongoDB. In Atlas → Network Access, allow access from anywhere (0.0.0.0/0) or your host’s IPs, then confirm the connection string.";
  }
  return "Could not reach MongoDB. Check MONGODB_URI and Atlas network access, then redeploy.";
}

export async function safeLoad(limit = 100) {
  if (!uri) {
    return {
      ok: false as const,
      total: 0,
      open: 0,
      records: [] as PortalRecord[],
      error: mongoErrorMessage(null),
    };
  }
  try {
    return await loadRecords(limit);
  } catch (error) {
    return {
      ok: false as const,
      total: 0,
      open: 0,
      records: [] as PortalRecord[],
      error: mongoErrorMessage(error),
    };
  }
}
