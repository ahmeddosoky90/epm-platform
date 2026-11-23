"use client";
/** Browser-side API client. All mutations go through REST endpoints that enforce authorization. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export async function apiFetch<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/")) { window.location.href = "/login?next=" + encodeURIComponent(location.pathname); }
  const ct = res.headers.get("content-type") ?? "";
  const payload = ct.includes("json") ? await res.json() : null;
  if (!res.ok) {
    const e = payload?.error ?? {};
    const reasons = e.details?.reasons as string[] | undefined;
    const fieldErrs = e.details?.fieldErrors ? Object.entries(e.details.fieldErrors as Record<string, string[]>).map(([k, v]) => `${k}: ${v.join(", ")}`) : [];
    throw new ApiError(res.status, e.code ?? "ERROR", [e.message ?? res.statusText, ...(reasons ?? []), ...fieldErrs].join(" — "), e.details);
  }
  return payload?.data as T;
}
