"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
export function ProjectTabs({ base, tabs }: { base: string; tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-black/[0.05] dark:bg-white/10" role="tablist">
      {tabs.map((t) => { const href = base + t.href; const on = t.href === "" ? path === base : path.startsWith(href);
        return <Link key={t.href} role="tab" aria-selected={on} href={href} className={clsx("tab", on && "tab-active")}>{t.label}</Link>; })}
    </div>
  );
}
