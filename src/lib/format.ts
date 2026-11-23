/** Locale/currency/timezone-aware formatting; never hard-code symbols or formats in components. */
export function money(v: unknown, currency = "EGP", locale = "en", compact = false) {
  const n = typeof v === "number" ? v : Number(v?.toString() ?? 0);
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-GB", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: compact ? 1 : 0, notation: compact ? "compact" : "standard" }).format(n);
}
export function num(v: unknown, digits = 0) { return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(Number(v?.toString() ?? 0)); }
export function date(d: Date | string | null | undefined, tz = "Africa/Cairo", locale = "en") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: tz }).format(new Date(d));
}
export function dateTime(d: Date | string | null | undefined, tz = "Africa/Cairo") {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d));
}
export function ago(d: Date | string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const minutes = (m: number | null | undefined) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
