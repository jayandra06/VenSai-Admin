import { deleteRecord } from "@/app/actions";
import type { PortalRecord } from "@/lib/db";
import { DeleteButton } from "@/components/DeleteButton";

function pill(status: string) {
  if (status === "Done") return "bg-emerald-50 text-emerald-700";
  if (status === "In progress") return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

export function RecordTable({
  rows,
  allowDelete = false,
}: {
  rows: PortalRecord[];
  allowDelete?: boolean;
}) {
  if (!rows.length) {
    return <p className="px-5 py-8 text-sm text-slate-500">No records yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-5 py-3 font-medium">Title</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Created</th>
            {allowDelete ? <th className="px-5 py-3 font-medium" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-50 last:border-0">
              <td className="px-5 py-3 font-medium text-slate-800">{row.title}</td>
              <td className="px-5 py-3 text-slate-600">{row.category}</td>
              <td className="px-5 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${pill(row.status)}`}>
                  {row.status}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-500">
                {new Date(row.createdAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </td>
              {allowDelete ? (
                <td className="px-5 py-3 text-right">
                  <DeleteButton id={row.id} action={deleteRecord} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
