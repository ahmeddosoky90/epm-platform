import { api } from "@/lib/api";
import { toggleWatch } from "@/lib/services/issues";
export const POST = api(async (_r, ctx, p) => toggleWatch(ctx, p.id));
