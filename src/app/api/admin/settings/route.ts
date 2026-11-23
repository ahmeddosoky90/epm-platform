import { api, body } from "@/lib/api";
import { settingsSchema, updateSettings } from "@/lib/services/admin";
export const PATCH = api(async (req, ctx) => updateSettings(ctx, await body(req, settingsSchema)));
