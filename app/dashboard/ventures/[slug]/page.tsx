import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addVenturePool,
  deleteVentureCluster,
  deleteVenturePool,
  inviteVentureOrganization,
  saveVenture,
  seedVentureAdmin,
} from "@/app/venture-actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EnvEditor } from "@/components/EnvEditor";
import { describeMongoUri } from "@/lib/env";
import { listOrganizations, listPlatformClusters } from "@/lib/org-invite";
import { ensurePlatformCluster } from "@/lib/platform-cluster";
import { clusterCapacity, findPreset, getVenture, isMongoUri, pingMongo } from "@/lib/ventures";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  saved: "Settings saved.",
  seeded: "Admin account seeded into the Rofyt database.",
  "uri-added": "MongoDB URI added.",
  "cluster-removed": "Organization cluster removed.",
  "uri-removed": "MongoDB URI removed.",
  invited: "Invitation sent. Org code, email, and temporary password were emailed to the customer admin.",
  "invited-no-mail":
    "Organization created and cluster assigned. Email was not sent — configure SMTP under Settings.",
};

const errors: Record<string, string> = {
  name: "Enter the project name.",
  creds: "Enter the admin email and password before seeding.",
  "missing-uri": "Add MONGODB_URI in the project .env. That database is where the admin is seeded.",
  "protected-db": "Point MONGODB_URI at a Rofyt database, not the central admin database.",
  "seed-failed": "Could not seed the admin. Check the MongoDB URI and Atlas network access.",
  "uri-invalid": "Use a mongodb:// or mongodb+srv:// connection string.",
  "uri-offline": "That MongoDB URI did not connect.",
  "cluster-remove": "Could not remove that organization cluster.",
  "uri-busy": "Remove the organizations on this URI before removing it.",
  "org-name": "Enter the organization name.",
  "org-email": "Enter a valid customer admin email.",
  "org-phone": "Enter the customer phone number.",
  "no-pool": "Add at least one MongoDB URI under company clusters first.",
  "no-capacity":
    "No cluster slots left, or cluster 0 is missing. Save .env with MONGODB_URI and add the same Atlas host as a URI pool.",
  "provision-failed": "Could not create the organization database on MongoDB.",
  missing: "That MongoDB URI could not be found.",
};

export default async function VenturePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { slug } = await params;
  const preset = findPreset(slug);
  if (!preset) notFound();
  const query = await searchParams;
  let venture = null;
  let loadError = "";
  try {
    await ensurePlatformCluster(slug);
    venture = await getVenture(slug);
  } catch {
    loadError = "Could not reach the central admin database.";
  }
  if (!venture && !loadError) notFound();

  const capacity = venture ? clusterCapacity(venture) : { used: 0, limit: 0, free: 0 };
  const organizations = venture ? listOrganizations(venture) : [];
  const platformClusters = venture ? listPlatformClusters(venture) : [];

  const appUri = venture?.env.find((row) => row.key === "MONGODB_URI")?.value.trim() || "";
  const appTarget = isMongoUri(appUri) ? describeMongoUri(appUri) : null;
  const [appOnline, poolStatus] = await Promise.all([
    venture && appTarget ? pingMongo(appUri) : Promise.resolve(false),
    venture
      ? Promise.all(venture.pools.map(async (pool) => ({ id: pool.id, online: await pingMongo(pool.uri) })))
      : Promise.resolve([]),
  ]);
  const onlineById = new Map(poolStatus.map((item) => [item.id, item.online]));
  const message = query.notice ? notices[query.notice] : query.error ? errors[query.error] : "";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/ventures" className="text-sm font-medium text-[#3C50E0]">
          Ventures
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{preset.name}</h1>
        <p className="text-sm text-slate-500">{preset.summary}</p>
        {venture ? (
          <p className="mt-2 text-sm font-medium text-slate-700">
            Clusters: {capacity.used} / {capacity.limit} used · {capacity.free} free (0 = Rofyt platform, 1+ = customers)
          </p>
        ) : null}
      </div>
      {loadError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</p>
      ) : null}
      {message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            query.error ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}
      {venture ? (
        <>
          <form action={saveVenture} className="space-y-6">
            <input type="hidden" name="slug" value={slug} />
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Project</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Project name
                  <input
                    name="name"
                    defaultValue={venture.name}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Deployed URL
                  <input
                    name="deployedUrl"
                    defaultValue={venture.deployedUrl}
                    placeholder="https://rofyt.example"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
                  />
                </label>
              </div>
              <div className="mt-5">
                <h3 className="font-medium text-slate-900">Project .env</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Paste the whole file, split it into fields, or copy it back as one .env.
                </p>
                <div className="mt-3">
                  <EnvEditor pairs={venture.env} />
                </div>
              </div>
            </section>
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Platform admin (Rofyt app)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Seed writes this admin into the database named on MONGODB_URI. The central portal database stays separate.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Admin email
                  <input
                    name="adminEmail"
                    type="email"
                    defaultValue={venture.adminEmail}
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Admin password
                  <input
                    name="adminPassword"
                    type="text"
                    defaultValue={venture.adminPassword}
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
                  />
                </label>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {appTarget
                  ? `App database ${appTarget.database} on ${appTarget.host} is ${appOnline ? "connected" : "offline"}.`
                  : "MONGODB_URI is not in the saved .env yet."}
              </p>
              {venture.lastSeed ? (
                <p className="mt-1 text-sm text-slate-500">
                  Last seeded {venture.lastSeed.email} into {venture.lastSeed.database}.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">
                  Save settings
                </button>
                <button
                  formAction={seedVentureAdmin}
                  className="rounded-lg bg-[#3C50E0] px-4 py-2.5 text-sm font-medium text-white"
                >
                  Seed account
                </button>
              </div>
            </section>
          </form>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Invite organization</h2>
            <p className="mt-1 text-sm text-slate-500">
              Assigns the next cluster ID (1, 2, 3… per URI, up to 699 customers after cluster 0). Database name is
              rofyt-N (e.g. rofyt-1). Emails org code, login, and temporary password. First login must reset password.
            </p>
            <form action={inviteVentureOrganization} className="mt-4 grid gap-3 md:grid-cols-2">
              <input type="hidden" name="slug" value={slug} />
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Organization name
                <input
                  name="organizationName"
                  required
                  placeholder="Harbor Cars Rental"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Customer admin email
                <input
                  name="adminEmail"
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone
                <input
                  name="phone"
                  required
                  placeholder="+91 ..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
                />
              </label>
              <button className="rounded-lg bg-[#3C50E0] px-4 py-2.5 text-sm font-medium text-white md:col-span-2 md:w-fit">
                Send invitation
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Organizations</h2>
              <p className="text-sm text-slate-500">
                Cluster 0 is the platform DB from MONGODB_URI. Each customer gets the next ID (1, 2, …) on that URI pool.
              </p>
            </div>
            {!organizations.length ? (
              <p className="px-5 py-8 text-sm text-slate-500">No organizations yet. Send the first invitation above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Cluster ID</th>
                      <th className="px-5 py-3 font-medium">Organization</th>
                      <th className="px-5 py-3 font-medium">Admin email</th>
                      <th className="px-5 py-3 font-medium">Phone</th>
                      <th className="px-5 py-3 font-medium">MongoDB database</th>
                      <th className="px-5 py-3 font-medium">URI pool</th>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map((org) => (
                      <tr key={`${org.poolId}-${org.id}`} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3 font-mono font-semibold text-slate-900">{org.orgCode || org.id}</td>
                        <td className="px-5 py-3 text-slate-800">{org.organizationName || org.company}</td>
                        <td className="px-5 py-3 text-slate-600">{org.adminEmail || "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{org.phone || "—"}</td>
                        <td className="px-5 py-3 font-mono text-slate-600">{org.database}</td>
                        <td className="px-5 py-3 text-slate-500">{org.poolLabel}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              org.emailSentAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {org.emailSentAt ? "Sent" : "Not sent"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <ConfirmSubmit
                            action={deleteVentureCluster}
                            fields={{ slug, poolId: org.poolId, clusterId: org.id }}
                            label="Remove"
                            message={`Remove ${org.organizationName || org.orgCode} and drop database ${org.database}?`}
                            className="text-sm font-medium text-rose-600"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">MongoDB URI pools</h2>
              <p className="text-sm text-slate-500">
                Each URI holds clusters 0–699 (700 total). Cluster 0 uses the .env database; add the same Atlas host here.
                When full, add a second URI (0–699 again).
              </p>
            </div>
            <form action={addVenturePool} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-4">
              <input type="hidden" name="slug" value={slug} />
              <input
                name="label"
                placeholder="Label"
                className="rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
              />
              <input
                name="uri"
                required
                placeholder="mongodb+srv://..."
                autoComplete="off"
                className="rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#3C50E0] md:col-span-2"
              />
              <input
                name="freeLimit"
                type="number"
                min={1}
                max={10000}
                defaultValue={700}
                className="rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
              />
              <button className="rounded-lg bg-[#3C50E0] px-4 py-2.5 text-sm font-medium text-white md:col-span-4 md:w-fit">
                Add MongoDB URI
              </button>
            </form>
            {platformClusters.length ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Platform cluster <span className="font-mono font-semibold">0</span> → database{" "}
                <span className="font-mono">{platformClusters[0]?.database}</span> on {platformClusters[0]?.poolLabel}
              </p>
            ) : null}
            {venture.pools.map((pool) => {
              const slotsLeft = pool.freeLimit - pool.clusters.length;
              const full = slotsLeft <= 0;
              const target = describeMongoUri(pool.uri);
              return (
                <article key={pool.id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{pool.label}</h3>
                      <p className="text-sm text-slate-500">
                        {target ? target.host : "URI saved"} · {onlineById.get(pool.id) ? "Connected" : "Offline"}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-slate-900">
                        {pool.clusters.length} / {pool.freeLimit} used
                      </p>
                      <p className="text-slate-500">{slotsLeft} free</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[#3C50E0]"
                      style={{ width: `${Math.min(100, (pool.clusters.length / pool.freeLimit) * 100)}%` }}
                    />
                  </div>
                  {full ? (
                    <p className="mt-3 text-sm text-amber-700">Free limit reached. Add another MongoDB URI to continue.</p>
                  ) : null}
                  {!pool.clusters.length ? (
                    <ConfirmSubmit
                      action={deleteVenturePool}
                      fields={{ slug, poolId: pool.id }}
                      label="Remove URI"
                      message="Remove this MongoDB URI?"
                      className="mt-4 text-sm font-medium text-rose-600"
                    />
                  ) : null}
                </article>
              );
            })}
          </section>
        </>
      ) : null}
    </div>
  );
}
