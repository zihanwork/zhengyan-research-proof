const encoder = new TextEncoder();
const bytesTo64 = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const from64 = (s) =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
async function key(secret) {
  if (!secret) throw new Error("服务端计划签名密钥未配置");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function signPlan(plan, secret) {
  const payload = bytesTo64(
    encoder.encode(JSON.stringify({ plan, expires: Date.now() + 20 * 60000 })),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(payload),
  );
  return `${payload}.${bytesTo64(signature)}`;
}
export async function readPlan(ticket, secret) {
  if (typeof ticket !== "string" || ticket.length > 18000)
    throw new Error("缺少有效核验计划，请先进行 AI 拆解");
  const [payload, signature, ...extra] = ticket.split(".");
  if (!payload || !signature || extra.length)
    throw new Error("计划凭证格式无效");
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      from64(signature),
      encoder.encode(payload),
    );
  } catch {}
  if (!ok) throw new Error("计划已被修改或凭证无效，请重新拆解");
  const decoded = JSON.parse(new TextDecoder().decode(from64(payload)));
  if (decoded.expires < Date.now()) throw new Error("计划已过期，请重新拆解");
  return decoded.plan;
}
