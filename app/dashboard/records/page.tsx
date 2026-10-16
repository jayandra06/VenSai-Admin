import { addRecord } from "@/app/actions";
import { RecordTable } from "@/components/RecordTable";
import { safeLoad } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const data = await safeLoad(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Records</h1>
        <p className="text-sm text-slate-500">Add and remove items stored in MongoDB.</p>
      </div>
      {"error" in data && data.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {data.error}
        </p>
      ) : null}
      <form action={addRecord} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-4">
        <input
          name="title"
          required
          placeholder="Title"
          className="rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0] md:col-span-2"
        />
        <select name="category" className="rounded-lg border border-slate-200 px-3 py-2.5">
          <option>General</option>
          <option>Billing</option>
          <option>Support</option>
        </select>
        <select name="status" className="rounded-lg border border-slate-200 px-3 py-2.5">
          <option>Open</option>
          <option>In progress</option>
          <option>Done</option>
        </select>
        <button className="rounded-lg bg-[#3C50E0] px-4 py-2.5 font-medium text-white md:col-span-4 md:w-fit">
          Add record
        </button>
      </form>
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <RecordTable rows={data.records} allowDelete />
      </section>
    </div>
  );
}
