import { safeLoad } from "@/lib/db";
import { RecordTable } from "@/components/RecordTable";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const data = await safeLoad(5);

  const cards = [
    { label: "Database", value: data.ok ? "Connected" : "Offline" },
    { label: "Records", value: String(data.total) },
    { label: "Open items", value: String(data.open) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Snapshot of the VenSai admin database.</p>
      </div>
      {"error" in data && data.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {data.error}
        </p>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Recent records</h2>
        </div>
        <RecordTable rows={data.records} />
      </section>
    </div>
  );
}
