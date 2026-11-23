import { api, body } from "@/lib/api";
import { mailAccountSchema, mailStatus, saveMailAccount, disconnectMail } from "@/lib/services/mail";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

export const GET = api(async (_r, ctx) => mailStatus(ctx));
export const PUT = api(async (req, ctx) => { if (!rateLimit(`mail-save:${ctx.user.id}`, 10, 10 * 60_000)) throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again in a few minutes."); return saveMailAccount(ctx, await body(req, mailAccountSchema)); });
export const DELETE = api(async (_r, ctx) => { await disconnectMail(ctx); return { connected: false }; });
