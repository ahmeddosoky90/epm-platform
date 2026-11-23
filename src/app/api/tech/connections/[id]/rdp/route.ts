import { api } from "@/lib/api";
import { rdpFile } from "@/lib/services/tech";
export const GET = api(async (_r, ctx, p) => { const f = await rdpFile(ctx, p.id); return new Response(f.body, { headers: { "content-type": "application/x-rdp", "content-disposition": `attachment; filename="${f.name}"` } }); });
