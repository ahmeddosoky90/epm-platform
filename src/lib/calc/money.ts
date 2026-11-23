import { Prisma } from "@prisma/client";
/** All money math uses Prisma.Decimal (decimal.js) — never JS floating point. */
export const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0);
export type Dec = Prisma.Decimal;
export const sum = (vals: (Prisma.Decimal.Value | null | undefined)[]) => vals.reduce<Dec>((a, v) => a.plus(D(v)), D(0));
