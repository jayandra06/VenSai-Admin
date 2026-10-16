import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { SideNav } from "@/components/SideNav";
import { getSession } from "@/lib/auth";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/ventures", label: "Ventures" },
  { href: "/dashboard/records", label: "Records" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-[#1C2434] text-slate-200 md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#3C50E0] text-xs font-bold text-white">
            VL
          </span>
          <div>
            <p className="text-sm font-semibold text-white">VenSai Labs</p>
            <p className="text-xs text-slate-400">Admin</p>
          </div>
        </div>
        <SideNav links={links} variant="side" />
      </aside>
      <div className="md:pl-60">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <SideNav links={links} variant="top" />
          <p className="hidden text-sm text-slate-500 md:block">{session.email}</p>
          <form action={logout}>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Log out
            </button>
          </form>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
