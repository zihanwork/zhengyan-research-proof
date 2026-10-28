import { getRuntime } from "./runtime";
const limits = new Map<string, { count: number; until: number }>();
export function apiResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function readBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Error("拒绝跨站请求");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("只接受 JSON");
  if (Number(request.headers.get("content-length") || 0) > 32000)
    throw new Error("请求体过大");
  const raw = await request.text();
  if (raw.length > 32000) throw new Error("请求体过大");
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const now = Date.now();
  if (limits.size > 1000)
    for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const old = limits.get(ip);
  const v = old && old.until > now ? old : { count: 0, until: now + 60000 };
  if (++v.count > 8) throw new Error("请求过于频繁，请 1 分钟后再试");
  limits.set(ip, v);
  return JSON.parse(raw);
}
export function safeError(error: unknown) {
  let text = error instanceof Error ? error.message : "请求失败";
  const env = getRuntime();
  for (const k of ["FUYAO_API_KEY", "IFIND_API_KEY", "LLM_API_KEY"])
    if (env[k]) text = text.replaceAll(String(env[k]), "***");
  return apiResponse({ ok: false, error: text.slice(0, 500) }, 400);
}
