import { saveSmtpSettings } from "@/app/settings-actions";
import { getPortalSmtpSettings, smtpReady } from "@/lib/portal-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; detail?: string }>;
}) {
  let smtp = { host: "", port: 587, secure: false, user: "", pass: "", from: "" };
  let loadError = "";
  try {
    smtp = await getPortalSmtpSettings();
  } catch {
    loadError = "Could not load settings from the central database.";
  }
  const query = await searchParams;
  const ready = smtpReady(smtp);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          One SMTP configuration for the whole admin portal. All venture invitation emails use these settings.
        </p>
      </div>
      {loadError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</p>
      ) : null}
      {query.notice === "saved" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          SMTP settings saved.
        </p>
      ) : null}
      {query.error === "required" ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          SMTP host and From address are required.
        </p>
      ) : null}
      {query.error === "db" ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {query.detail
            ? decodeURIComponent(query.detail)
            : "Could not save settings — the admin portal could not reach MongoDB. In Atlas → Network Access for cluster0.6zs5dc0, allow 0.0.0.0/0 (or Vercel IPs), then try again."}
        </p>
      ) : null}
      <form action={saveSmtpSettings} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">SMTP</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {ready ? "Ready for invitations" : "Not configured"}
          </span>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          SMTP host
          <input
            name="host"
            required
            defaultValue={smtp.host}
            placeholder="smtp.gmail.com"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Port
            <input
              name="port"
              type="number"
              min={1}
              max={65535}
              defaultValue={smtp.port || 587}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
            />
          </label>
          <label className="flex items-end gap-2 pb-2.5 text-sm font-medium text-slate-700">
            <input name="secure" type="checkbox" defaultChecked={smtp.secure} className="h-4 w-4 rounded" />
            Use SSL/TLS (port 465)
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          SMTP username
          <input
            name="user"
            defaultValue={smtp.user}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          SMTP password
          <input
            name="pass"
            type="password"
            autoComplete="new-password"
            placeholder={smtp.pass ? "Leave blank to keep current password" : "Enter SMTP password"}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          From address
          <input
            name="from"
            required
            defaultValue={smtp.from}
            placeholder="VenSai Labs <noreply@vensailabs.in>"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
          />
        </label>
        <button className="rounded-lg bg-[#3C50E0] px-4 py-2.5 text-sm font-medium text-white">Save SMTP settings</button>
      </form>
    </div>
  );
}
