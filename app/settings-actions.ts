"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { mongoErrorMessage } from "@/lib/db";
import { savePortalSmtpSettings } from "@/lib/portal-settings";

async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/");
}

export async function saveSmtpSettings(formData: FormData) {
  await requireUser();
  const host = String(formData.get("host") || "").trim();
  const from = String(formData.get("from") || "").trim();
  const port = Math.min(65535, Math.max(1, Number(formData.get("port")) || 587));
  const secure = formData.get("secure") === "on";
  const user = String(formData.get("user") || "").trim();
  const pass = String(formData.get("pass") || "");
  if (!host || !from) redirect("/dashboard/settings?error=required");
  try {
    await savePortalSmtpSettings({ host, port, secure, user, pass, from });
  } catch (error) {
    console.error("saveSmtpSettings:", error);
    const detail = encodeURIComponent(mongoErrorMessage(error).slice(0, 400));
    redirect(`/dashboard/settings?error=db&detail=${detail}`);
  }
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/ventures");
  redirect("/dashboard/settings?notice=saved");
}
