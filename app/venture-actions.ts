"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { describeMongoUri } from "@/lib/env";
import {
  addPool,
  createCompanyCluster,
  findPreset,
  getVenture,
  isMongoUri,
  pingMongo,
  readSettings,
  rememberSeed,
  removeCompanyCluster,
  removePool,
  saveSettings,
  seedAdminAccount,
} from "@/lib/ventures";

async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/");
}

function go(slug: string, kind: "notice" | "error", code: string) {
  redirect(`/dashboard/ventures/${slug}?${kind}=${code}`);
}

function refresh(slug: string) {
  revalidatePath("/dashboard/ventures");
  revalidatePath(`/dashboard/ventures/${slug}`);
}

export async function saveVenture(formData: FormData) {
  await requireUser();
  const slug = String(formData.get("slug") || "");
  if (!findPreset(slug)) redirect("/dashboard/ventures");
  const input = readSettings(formData);
  if (!input.name) go(slug, "error", "name");
  await saveSettings(slug, input);
  refresh(slug);
  go(slug, "notice", "saved");
}

export async function seedVentureAdmin(formData: FormData) {
  await requireUser();
  const slug = String(formData.get("slug") || "");
  if (!findPreset(slug)) redirect("/dashboard/ventures");
  const input = readSettings(formData);
  if (!input.name) go(slug, "error", "name");
  if (!input.adminEmail || !input.adminPassword) go(slug, "error", "creds");
  const saved = await saveSettings(slug, input);
  const uri = saved?.env.find((row) => row.key === "MONGODB_URI")?.value.trim() || "";
  if (!isMongoUri(uri)) go(slug, "error", "missing-uri");
  const target = describeMongoUri(uri);
  if (!target || target.database === "vensai" || target.database === "admin") go(slug, "error", "protected-db");
  try {
    const seeded = await seedAdminAccount(uri, input.adminEmail, input.adminPassword);
    await rememberSeed(slug, { email: input.adminEmail, ...seeded });
  } catch {
    refresh(slug);
    go(slug, "error", "seed-failed");
  }
  refresh(slug);
  go(slug, "notice", "seeded");
}

export async function addVenturePool(formData: FormData) {
  await requireUser();
  const slug = String(formData.get("slug") || "");
  if (!findPreset(slug)) redirect("/dashboard/ventures");
  const uri = String(formData.get("uri") || "").trim();
  const label = String(formData.get("label") || "").trim();
  const freeLimit = Math.min(10000, Math.max(1, Number(formData.get("freeLimit")) || 700));
  if (!isMongoUri(uri)) go(slug, "error", "uri-invalid");
  const online = await pingMongo(uri);
  if (!online) go(slug, "error", "uri-offline");
  await addPool(slug, label, uri, freeLimit);
  refresh(slug);
  go(slug, "notice", "uri-added");
}

export async function createVentureCluster(formData: FormData) {
  await requireUser();
  const slug = String(formData.get("slug") || "");
  const poolId = String(formData.get("poolId") || "");
  const company = String(formData.get("company") || "").trim();
  if (!findPreset(slug)) redirect("/dashboard/ventures");
  const result = await createCompanyCluster(slug, poolId, company);
  refresh(slug);
  if (result === "ok") go(slug, "notice", "cluster-created");
  go(slug, "error", result);
}

export async function deleteVentureCluster(formData: FormData) {
  await requireUser();
  const slug = String(formData.get("slug") || "");
  const poolId = String(formData.get("poolId") || "");
  const clusterId = String(formData.get("clusterId") || "");
  if (!findPreset(slug)) redirect("/dashboard/ventures");
  try {
    const removed = await removeCompanyCluster(slug, poolId, clusterId);
    refresh(slug);
    go(slug, removed ? "notice" : "error", removed ? "cluster-removed" : "cluster-remove");
  } catch {
    refresh(slug);
    go(slug, "error", "cluster-remove");
  }
}

export async function deleteVenturePool(formData: FormData) {
  await requireUser();
  const slug = String(formData.get("slug") || "");
  const poolId = String(formData.get("poolId") || "");
  if (!findPreset(slug)) redirect("/dashboard/ventures");
  const venture = await getVenture(slug);
  if (!venture) redirect("/dashboard/ventures");
  const removed = await removePool(slug, poolId);
  refresh(slug);
  go(slug, removed ? "notice" : "error", removed ? "uri-removed" : "uri-busy");
}
