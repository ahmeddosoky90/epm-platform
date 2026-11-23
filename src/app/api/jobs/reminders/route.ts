import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { errorResponse } from "@/lib/api";
import { getCtx, can } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { runReminders } from "@/lib/services/reminders";

/** Run by a scheduler with header `Authorization: Bearer $CRON_SECRET`, or manually by a workspace admin. */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const okSecret = !!secret && auth.length === secret.length && timingSafeEqual(Buffer.from(auth), Buffer.from(secret));
    if (!okSecret) {
      const ctx = await getCtx();
      if (!ctx || !can(ctx, "admin:workspace")) throw new AppError(401, "UNAUTHORIZED", "Scheduler secret or admin session required");
    }
    return NextResponse.json({ data: await runReminders() });
  } catch (e) { return errorResponse(e); }
}
