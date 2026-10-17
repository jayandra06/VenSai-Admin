import { getDb } from "@/lib/db";

export type PortalSmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

const SETTINGS_KEY = "global";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function getPortalSmtpSettings(): Promise<PortalSmtpSettings> {
  const db = await getDb();
  const doc = await db.collection("portal_settings").findOne({ key: SETTINGS_KEY });
  const smtp = (doc?.smtp ?? {}) as Record<string, unknown>;
  return {
    host: asString(smtp.host),
    port: Number(smtp.port) || 587,
    secure: smtp.secure === true,
    user: asString(smtp.user),
    pass: asString(smtp.pass),
    from: asString(smtp.from),
  };
}

export function smtpReady(settings: PortalSmtpSettings) {
  return Boolean(settings.host.trim() && settings.from.trim());
}

export async function savePortalSmtpSettings(input: PortalSmtpSettings) {
  const current = await getPortalSmtpSettings();
  const db = await getDb();
  await db.collection("portal_settings").updateOne(
    { key: SETTINGS_KEY },
    {
      $set: {
        key: SETTINGS_KEY,
        smtp: {
          host: input.host.trim(),
          port: input.port || 587,
          secure: input.secure,
          user: input.user.trim(),
          pass: input.pass || current.pass,
          from: input.from.trim(),
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}
