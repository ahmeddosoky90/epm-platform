import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

export interface AuditInput {
  workspaceId?: string | null;
  userId?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

const json = (v: unknown) =>
  v === undefined ? undefined : v === null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

/** Append an audit record. Pass a transaction client to keep it atomic with the change. */
export async function audit(input: AuditInput, tx: Tx = prisma) {
  await tx.auditLog.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      userId: input.userId ?? null,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: json(input.before),
      after: json(input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
