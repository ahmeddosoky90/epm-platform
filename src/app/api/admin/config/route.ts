import { api, body } from "@/lib/api";
import { changeConfig, configSchema } from "@/lib/services/admin";
export const POST = api(async (req, ctx) => changeConfig(ctx, await body(req, configSchema)));
