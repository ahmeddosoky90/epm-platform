import { api, body } from "@/lib/api";
import { connectionSchema, listConnections, saveConnection } from "@/lib/services/tech";
export const GET = api(async (_r, ctx) => listConnections(ctx));
export const POST = api(async (req, ctx) => saveConnection(ctx, await body(req, connectionSchema)));
