import { api, body } from "@/lib/api";
import { updateUser, userPatchSchema } from "@/lib/services/admin";
export const PATCH = api(async (req, ctx, p) => updateUser(ctx, p.id, await body(req, userPatchSchema)));
