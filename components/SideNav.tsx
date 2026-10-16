"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({
  links,
  variant,
}: {
  links: { href: string; label: string }[];
  variant: "side" | "top";
}) {
  const pathname = usePathname();
  return (
    <nav className={variant === "side" ? "flex flex-1 flex-col gap-1 px-3" : "flex gap-3 md:hidden"}>
      {links.map((link) => {
        const active = link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              variant === "side"
                ? `rounded-lg px-3 py-2 text-sm ${active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`
                : `text-sm font-medium ${active ? "text-[#3C50E0]" : "text-slate-600"}`
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
