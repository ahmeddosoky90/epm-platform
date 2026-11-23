import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!rateLimit(`login:${ip}`, 20, 60_000)) throw new AppError(429, "RATE_LIMITED", "Too many sign-in attempts. Wait a minute and try again.");
    const { email, password } = schema.parse(await req.json());
    const r = await login(email, password);
    return NextResponse.json({ data: r });
  } catch (e) { return errorResponse(e); }
}
