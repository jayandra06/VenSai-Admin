import Link from "next/link";
import { listVentures } from "@/lib/ventures";

export const dynamic = "force-dynamic";

export default async function VenturesPage() {
  let ventures: Awaited<ReturnType<typeof listVentures>> = [];
  let error = "";
  try {
    ventures = await listVentures();
  } catch {
    error = "Could not reach the central admin database.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ventures</h1>
        <p className="text-sm text-slate-500">Open a venture to manage its project settings and company databases.</p>
      </div>
      {error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ventures.map((venture) => (
          <Link
            key={venture.slug}
            href={`/dashboard/ventures/${venture.slug}`}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-transparent hover:ring-[#3C50E0]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#3C50E0] text-sm font-bold text-white">
              {venture.name.slice(0, 2).toUpperCase()}
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{venture.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{venture.summary}</p>
            <p className="mt-4 text-sm text-slate-600">
              {venture.uris} MongoDB URIs · {venture.clusters} company clusters
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
