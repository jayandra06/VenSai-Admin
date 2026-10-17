import { getPortalSmtpSettings, smtpReady } from "@/lib/portal-settings";

type InvitePayload = {
  ventureName: string;
  to: string;
  orgName: string;
  orgCode: string;
  email: string;
  password: string;
  loginUrl: string;
};

export async function sendOrganizationInvite(payload: InvitePayload) {
  const smtp = await getPortalSmtpSettings();
  if (!smtpReady(smtp)) return { sent: false as const, reason: "no-smtp" as const };

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure || smtp.port === 465,
    auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  const text = [
    `Welcome to ${payload.ventureName}, ${payload.orgName}.`,
    "",
    "Your organization has been created. Use these details on first login:",
    "",
    `Organization code (cluster ID): ${payload.orgCode}`,
    `Login email: ${payload.email}`,
    `Temporary password: ${payload.password}`,
    "",
    `Sign in: ${payload.loginUrl}`,
    "",
    "You will be asked to set a new password on first login.",
  ].join("\n");

  await transporter.sendMail({
    from: smtp.from,
    to: payload.to,
    subject: `${payload.ventureName} invitation — cluster ${payload.orgCode}`,
    text,
  });

  return { sent: true as const };
}
