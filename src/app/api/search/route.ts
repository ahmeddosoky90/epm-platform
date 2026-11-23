import { api, pageParams } from "@/lib/api";
import { quickSearch, runEql } from "@/lib/services/search";
export const GET = api(async (req, ctx) => {
  const sp = req.nextUrl.searchParams; const { take, skip } = pageParams(req);
  if (sp.get("jql") !== null) return runEql(ctx, sp.get("jql") ?? "", take, skip);
  return quickSearch(ctx, (sp.get("q") ?? "").slice(0, 100));
});
