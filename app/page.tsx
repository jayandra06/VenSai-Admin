import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { getSession } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-[#1C2434] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#3C50E0] text-sm font-bold">
            VL
          </span>
          <span className="text-lg font-semibold">VenSai Labs</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight">
            Admin portal for day-to-day operations.
          </h1>
          <p className="mt-4 max-w-sm text-slate-300">
            Sign in to review records and check the database connection.
          </p>
        </div>
        <p className="text-sm text-slate-400">Internal use only</p>
      </section>
      <section className="flex items-center justify-center bg-slate-50 px-6">
        <form action={login} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#3C50E0]">VenSai Labs</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your admin email and password.</p>
          {error ? (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Invalid email or password.
            </p>
          ) : null}
          <label className="mt-6 block text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#3C50E0]"
            />
          </label>
          <button className="mt-6 w-full rounded-lg bg-[#3C50E0] py-2.5 font-medium text-white hover:bg-[#3143c9]">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
