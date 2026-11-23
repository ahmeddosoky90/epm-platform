import { NextResponse } from "next/server";
import { destroySession, getCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST() {
  const ctx = await getCtx();
  if (ctx) await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "auth.logout", entityType: "User", entityId: ctx.user.id, ip: ctx.ip });
  await destroySession();
  return NextResponse.json({ data: { ok: true } });
}
