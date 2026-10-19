import { getDb } from "@/lib/db";

export type CrmAccessRecord = {
  email: string;
  workEmail: string | null;
  name: string | null;
  ventureSlugs: string[];
  crmEnabled: boolean;
  updatedAt: string;
};

export async function upsertCrmAccess(record: Omit<CrmAccessRecord, "updatedAt">) {
  const email = record.email.trim().toLowerCase();
  if (!email) throw new Error("email required");
  const db = await getDb();
  const doc: CrmAccessRecord = {
    email,
    workEmail: record.workEmail?.trim().toLowerCase() || null,
    name: record.name?.trim() || null,
    ventureSlugs: [...new Set(record.ventureSlugs.map((s) => s.trim()).filter(Boolean))],
    crmEnabled: record.crmEnabled,
    updatedAt: new Date().toISOString(),
  };
  await db.collection("crm_user_access").updateOne({ email }, { $set: doc }, { upsert: true });
  return doc;
}

export async function getCrmAccess(email: string) {
  const db = await getDb();
  return db.collection<CrmAccessRecord>("crm_user_access").findOne({
    email: email.trim().toLowerCase(),
  });
}
