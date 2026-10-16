"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, getSession, setSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const ok =
    email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD;
  if (!ok) redirect("/?error=1");
  await setSession(email);
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/");
}

async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

export async function addRecord(formData: FormData) {
  await requireUser();
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "General");
  const status = String(formData.get("status") || "Open");
  const categories = ["General", "Billing", "Support"];
  const statuses = ["Open", "In progress", "Done"];
  if (!title || !categories.includes(category) || !statuses.includes(status)) return;
  const db = await getDb();
  await db.collection("records").insertOne({
    title,
    category,
    status,
    createdAt: new Date(),
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/records");
}

export async function deleteRecord(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  if (!ObjectId.isValid(id)) return;
  const db = await getDb();
  await db.collection("records").deleteOne({ _id: new ObjectId(id) });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/records");
}
