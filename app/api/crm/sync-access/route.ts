import { NextResponse } from "next/server";
import { upsertCrmAccess } from "@/lib/crm-access";

function authorize(request: Request) {
  const secret = process.env.CRM_SYNC_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === secret;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row = body as {
    email?: string;
    workEmail?: string | null;
    name?: string | null;
    ventureSlugs?: string[];
    crmEnabled?: boolean;
  };

  if (!row.email?.trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const record = await upsertCrmAccess({
    email: row.email,
    workEmail: row.workEmail ?? null,
    name: row.name ?? null,
    ventureSlugs: Array.isArray(row.ventureSlugs) ? row.ventureSlugs : [],
    crmEnabled: row.crmEnabled !== false,
  });

  return NextResponse.json({ ok: true, record: { email: record.email, ventureSlugs: record.ventureSlugs } });
}
