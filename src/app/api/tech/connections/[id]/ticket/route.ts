import { api } from "@/lib/api";
import { terminalTicket } from "@/lib/services/tech";
export const POST = api(async (_r, ctx, p) => terminalTicket(ctx, p.id));
