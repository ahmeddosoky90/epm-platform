import { api } from "@/lib/api";
import { testConnection } from "@/lib/services/tech";
export const POST = api(async (_r, ctx, p) => testConnection(ctx, p.id));
