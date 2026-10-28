import { DAY, compactDay, parseIfind } from "./proof-engine.mjs";
const BASE = "https://fuyao.aicubes.cn";
export async function jsonFetch(url, options = {}, fetcher = fetch) {
  const r = await fetcher(url, {
    ...options,
    signal: AbortSignal.timeout(25000),
  });
  const text = await r.text();
  if (text.length > 2000000) throw new Error("响应超出 2 MB 上限");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${r.status} 返回非 JSON`);
  }
  if (!r.ok)
    throw new Error(
      `HTTP ${r.status}${r.status === 429 ? "：触发限流，请稍后重试" : ""}`,
    );
  return { data, headers: r.headers };
}
export async function collectSources(
  input,
  env,
  fetcher = fetch,
  now = Date.now(),
) {
  const start = now - 100 * DAY,
    end = now;
  const base = {
    thscode: input.symbol,
    interval: "1d",
    start: String(start),
    end: String(end),
  };
  const configs = [
    [
      "calendar",
      "交易日历",
      "/api/a-share/calendar/trading-days",
      { start_date: compactDay(start), end_date: compactDay(end) },
    ],
    [
      "history",
      "个股前复权日线",
      "/api/a-share/prices/historical",
      { ...base, adjust: "forward" },
    ],
    [
      "benchmark",
      "沪深 300 日线",
      "/api/a-share-index/prices/historical",
      { ...base, thscode: "000300.SH" },
    ],
    [
      "valuation",
      "估值快照",
      "/api/a-share/valuations/snapshot",
      { thscodes: input.symbol },
    ],
    [
      "snapshot",
      "行情快照",
      "/api/a-share/prices/snapshot",
      { thscodes: input.symbol },
    ],
  ];
  const sources = [];
  // Two concurrent requests at most; no hidden retries on rate limits.
  for (let i = 0; i < configs.length; i += 2) {
    sources.push(
      ...(await Promise.all(
        configs.slice(i, i + 2).map(async ([id, label, path, params]) => {
          const url = `${BASE}${path}?${new URLSearchParams(params)}`;
          const t = Date.now();
          try {
            if (!env.FUYAO_API_KEY) throw new Error("未配置扶摇 API Key");
            const { data } = await jsonFetch(
              url,
              { headers: { "X-api-key": env.FUYAO_API_KEY } },
              fetcher,
            );
            if (data.code !== 0)
              throw new Error(
                `扶摇业务码 ${data.code}：${String(data.message).slice(0, 120)}`,
              );
            if (!Array.isArray(data.data?.item))
              throw new Error("响应缺少 data.item");
            return {
              id,
              label,
              provider: "扶摇",
              url,
              params,
              ok: true,
              raw: data,
              request_id: data.request_id || null,
              fetched_at: new Date().toISOString(),
              duration_ms: Date.now() - t,
              data_at: data.data?.timestamp || null,
            };
          } catch (e) {
            return {
              id,
              label,
              provider: "扶摇",
              url,
              params,
              ok: false,
              error: e.message,
              fetched_at: new Date().toISOString(),
              duration_ms: Date.now() - t,
            };
          }
        }),
      )),
    );
  }
  const t = Date.now();
  const url =
    "https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp";
  const args = {
    symbols: input.symbol,
    indicators: "最新价,涨跌幅",
    data_mode: "real_time",
  };
  try {
    if (!env.IFIND_API_KEY) throw new Error("未配置 iFinD API Key");
    let session = null;
    let id = 0;
    const post = async (method, params) => {
      const { data, headers } = await jsonFetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            Authorization: env.IFIND_API_KEY,
            "User-Agent": "codex",
            ...(session ? { "Mcp-Session-Id": session } : {}),
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            ...(method === "notifications/initialized" ? {} : { id: ++id }),
            method,
            ...(params ? { params } : {}),
          }),
        },
        fetcher,
      );
      if (data.error)
        throw new Error(
          `MCP ${data.error.code}：${String(data.error.message).slice(0, 120)}`,
        );
      return { data, headers };
    };
    const init = await post("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "zhengyan-proof", version: "1.0.0" },
    });
    session = init.headers.get("mcp-session-id");
    if (!session) throw new Error("MCP 未返回会话 ID");
    // Notification may be a 202 empty body, so do not assume JSON here.
    const nr = await fetcher(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: env.IFIND_API_KEY,
        "Mcp-Session-Id": session,
        "User-Agent": "codex",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!nr.ok) throw new Error(`MCP 初始化通知 HTTP ${nr.status}`);
    const listed = await post("tools/list", {});
    if (
      !listed.data.result?.tools?.some(
        (x) => x.name === "stock_highfreq_quotes",
      )
    )
      throw new Error("当前权益无报价核验工具");
    const { data } = await post("tools/call", {
      name: "stock_highfreq_quotes",
      arguments: args,
    });
    if (data.result?.isError) throw new Error("iFinD 工具返回错误");
    const inner = parseIfind(data);
    if (!inner || inner.code !== 1)
      throw new Error(`iFinD 业务异常 ${inner?.msg || "非预期数据结构"}`);
    sources.push({
      id: "ifind",
      label: "iFinD 报价交叉检查",
      provider: "iFinD MCP",
      url,
      params: args,
      ok: true,
      raw: data,
      fetched_at: new Date().toISOString(),
      duration_ms: Date.now() - t,
      data_at: inner.data?.tables?.[1]?.[2] || null,
    });
  } catch (e) {
    sources.push({
      id: "ifind",
      label: "iFinD 报价交叉检查",
      provider: "iFinD MCP",
      url,
      params: args,
      ok: false,
      error: e.message,
      fetched_at: new Date().toISOString(),
      duration_ms: Date.now() - t,
    });
  }
  return sources;
}
