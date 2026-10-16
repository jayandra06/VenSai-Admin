import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addVenturePool,
  createVentureCluster,
  deleteVentureCluster,
  deleteVenturePool,
  saveVenture,
  seedVentureAdmin,
} from "@/app/venture-actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EnvEditor } from "@/components/EnvEditor";
import { describeMongoUri } from "@/lib/env";
import { findPreset, getVenture, isMongoUri, pingMongo } from "@/lib/ventures";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  saved: "Settings saved.",
  seeded: "Admin account seeded into the Rofyt database.",
  "uri-added": "MongoDB URI added.",
  "cluster-created": "Company cluster created and assigned to Rofyt.",
  "cluster-removed": "Company cluster removed.",
  "uri-removed": "MongoDB URI removed.",
};

const errors: Record<string, string> = {
  name: "Enter the project name.",
  company: "Enter a company name.",
  creds: "Enter the admin email and password before seeding.",
  "missing-uri": "Add MONGODB_URI in the project .env. That database is where the admin is seeded.",
  "protected-db": "Point MONGODB_URI at a Rofyt database, not the central admin database.",
  "seed-failed": "Could not seed the admin. Check the MongoDB URI and Atlas network access.",
  "uri-invalid": "Use a mongodb:// or mongodb+srv:// connection string.",
  "uri-offline": "That MongoDB URI did not connect.",
  limit: "This URI has reached its free cluster limit. Add another MongoDB URI.",
  duplicate: "That company already has a cluster on this URI.",
  failed: "Could not create the company database on that URI.",
  missing: "That MongoDB URI could not be found.",
  "cluster-remove": "Could not remove that company cluster.",
  "uri-busy": "Remove the company clusters before removing this URI.",
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
    venture = await getVenture(slug);
  } catch {
    loadError = "Could not reach the central admin database.";
  }
  if (!venture && !loadError) notFound();

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
              <h2 className="font-semibold text-slate-900">Admin account</h2>
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
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Company clusters</h2>
              <p className="text-sm text-slate-500">
                Add a MongoDB URI and set how many free company databases it can hold. Each car rental company gets one database. When a URI is full, add another URI.
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
            {venture.pools.map((pool) => {
              const full = pool.clusters.length >= pool.freeLimit;
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
                    <p className="text-sm font-medium text-slate-700">
                      {pool.clusters.length} / {pool.freeLimit}
                    </p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[#3C50E0]"
                      style={{ width: `${Math.min(100, (pool.clusters.length / pool.freeLimit) * 100)}%` }}
                    />
                  </div>
                  {full ? (
                    <p className="mt-3 text-sm text-amber-700">Free limit reached. Add another MongoDB URI to continue.</p>
                  ) : (
                    <form action={createVentureCluster} className="mt-4 flex flex-wrap gap-2">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="poolId" value={pool.id} />
                      <input
                        name="company"
                        required
                        placeholder="Car rental company"
                        className="min-w-56 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
                      />
                      <button className="rounded-lg bg-[#3C50E0] px-4 py-2.5 text-sm font-medium text-white">
                        Create cluster
                      </button>
                    </form>
                  )}
                  <div className="mt-4 divide-y divide-slate-100">
                    {pool.clusters.map((cluster) => (
                      <div key={cluster.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{cluster.company}</p>
                          <p className="text-slate-500">{cluster.database}</p>
                        </div>
                        <ConfirmSubmit
                          action={deleteVentureCluster}
                          fields={{ slug, poolId: pool.id, clusterId: cluster.id }}
                          label="Remove"
                          message={`Remove ${cluster.company} and its database?`}
                          className="text-sm font-medium text-rose-600"
                        />
                      </div>
                    ))}
                    {!pool.clusters.length ? <p className="py-3 text-sm text-slate-500">No companies on this URI yet.</p> : null}
                  </div>
                  {!pool.clusters.length ? (
                    <ConfirmSubmit
                      action={deleteVenturePool}
                      fields={{ slug, poolId: pool.id }}
                      label="Remove URI"
                      message="Remove this MongoDB URI?"
                      className="text-sm font-medium text-rose-600"
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
