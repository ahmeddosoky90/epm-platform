import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, badRequest } from "./errors";
import { requireCtx, type Ctx } from "./auth";
import { rateLimit } from "./rate-limit";

type RouteCtx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, ctx: Ctx, params: Record<string, string>) => Promise<unknown>;

/**
 * Wraps a REST handler: authentication, CSRF (Origin check on mutations), rate limiting,
 * uniform JSON envelope { data } / { error: { code, message, details } }.
 */
export function api(handler: Handler, opts: { public?: false } = {}) {
  void opts;
  return async (req: NextRequest, rc: RouteCtx) => {
    try {
      checkOrigin(req);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
      if (!rateLimit(`api:${ip}`, 600, 60_000)) throw new AppError(429, "RATE_LIMITED", "Too many requests");
      const ctx = await requireCtx();
      const params = rc?.params ? await rc.params : {};
      const result = await handler(req, ctx, params);
      if (result instanceof Response) return result;
      return NextResponse.json({ data: result ?? null }, { status: req.method === "POST" ? 201 : 200 });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function checkOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server) have no Origin; cookie is SameSite=Lax
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new AppError(403, "CSRF", "Cross-origin request blocked");
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(403, "CSRF", "Invalid origin");
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: { code: "VALIDATION", message: "Invalid input", details: e.flatten() } }, { status: 422 });
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return NextResponse.json({ error: { code: "CONFLICT", message: `Already exists: ${(e.meta?.target as string[] | undefined)?.join(", ") ?? "unique value"}` } }, { status: 409 });
    if (e.code === "P2025") return NextResponse.json({ error: { code: "NOT_FOUND", message: "Record not found" } }, { status: 404 });
  }
  console.error("[api] unhandled", e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Unexpected server error" } }, { status: 500 });
}

export async function body<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw badRequest("Request body must be JSON"); }
  return schema.parse(raw);
}

export function pageParams(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const take = Math.min(Math.max(Number(sp.get("pageSize") ?? 50), 1), 200);
  const page = Math.max(Number(sp.get("page") ?? 1), 1);
  return { take, skip: (page - 1) * take, page };
}
