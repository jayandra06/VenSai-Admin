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

export async function safeLoad(limit = 100) {
  try {
    return await loadRecords(limit);
  } catch {
    return {
      ok: false as const,
      total: 0,
      open: 0,
      records: [] as PortalRecord[],
      error: "Could not reach MongoDB. Check the connection string and Atlas network access.",
    };
  }
}
