import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Liveness/readiness probe for load balancers and monitoring. No authentication, no data disclosed. */
export async function GET() {
  const started = Date.now();
  try { await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ status: "ok", db: "ok", ms: Date.now() - started }); }
  catch { return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 }); }
}
