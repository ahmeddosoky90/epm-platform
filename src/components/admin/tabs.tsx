"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AdminTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return <nav className="inline-flex flex-wrap gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1" aria-label="Administration sections">{tabs.map((t) => <Link key={t.href} href={t.href} className={`px-3 h-8 inline-flex items-center rounded-lg text-sm ${path.startsWith(t.href) ? "bg-[var(--card)] shadow-sm font-medium" : "text-ink-2"}`}>{t.label}</Link>)}</nav>;
}
