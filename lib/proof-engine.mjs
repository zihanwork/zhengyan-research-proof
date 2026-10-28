// Pure calculations, provenance and policy live outside model code and are testable without an LLM.
export const METRICS = [
  "return",
  "relative_return",
  "turnover_ratio",
  "pe_ttm",
  "price_change",
  "causality",
  "unsupported",
];
export const DAY = 86400000;
export const chinaDay = (ms) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
export const compactDay = (ms) => chinaDay(ms).replaceAll("-", "");
export const finite = (v) => typeof v === "number" && Number.isFinite(v);
export const compliance = (text) =>
  /(?:保证|承诺|稳赚|必赚|保本|无风险).{0,10}(?:收益|盈利|赚|回报)|(?:明天|下周|未来|后市).{0,8}(?:必涨|必跌|一定涨|一定跌|肯定涨|肯定跌)|(?:建议|应该|立即|现在|务必|直接|马上).{0,6}(?:买入|卖出|加仓|减仓|清仓|抄底|满仓)|(?:买入|卖出|加仓|减仓|清仓|抄底|满仓)|\b(?:buy|sell|guaranteed returns?)\b/i.test(
    text,
  );
export function validatePlan(plan, input) {
  if (
    !plan ||
    !Array.isArray(plan.claims) ||
    !plan.claims.length ||
    plan.claims.length > 5
  )
    throw new Error("模型未返回 1–5 条有效主张，请重新拆解。");
  return {
    claims: plan.claims.map((c, i) => {
      if (
        !c ||
        typeof c.text !== "string" ||
        !input.text.includes(c.text) ||
        !METRICS.includes(c.metric) ||
        !["gt", "lt", "eq", "unknown"].includes(c.operator)
      )
        throw new Error("模型主张未通过原文或指标校验；未执行任何取数。");
      if (c.operator !== "unknown" && !finite(c.threshold))
        throw new Error("模型未提供有效比较阈值，请修改原文后重试。");
      if (c.text.length > 500) throw new Error("单条主张过长。");
      return {
        id: `C${i + 1}`,
        text: c.text,
        metric: c.metric,
        operator: c.operator,
        threshold: c.operator === "unknown" ? null : c.threshold,
        kind:
          c.metric === "causality"
            ? "inference"
            : c.metric === "unsupported"
              ? "uncertain"
              : "fact",
        note: String(c.note || "").slice(0, 240),
      };
    }),
    input: { text: input.text, symbol: input.symbol, window: input.window },
    created_at: new Date().toISOString(),
  };
}
export function validateInput(input) {
  if (
    !input ||
    typeof input.text !== "string" ||
    !input.text.trim() ||
    input.text.length > 1600
  )
    throw new Error("请提供 1–1600 字的待核验观点。");
  if (!/^\d{6}\.(SH|SZ|BJ)$/.test(input.symbol))
    throw new Error("证券代码须为 600519.SH 等完整 A 股代码。");
  if (![5, 10, 20].includes(input.window))
    throw new Error("窗口仅支持 5、10 或 20 个交易日。");
  if (compliance(input.text))
    throw new Error(
      "合规拦截：请删除直接买卖建议、确定性涨跌判断或收益承诺，仅提交可检验的研究主张。",
    );
  return input;
}
export function expectedClose(calendar, now) {
  const day = chinaDay(now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(now));
  const eligible = calendar.filter(
    (x) =>
      typeof x.date === "string" &&
      (x.date < day.replaceAll("-", "") ||
        (x.date === day.replaceAll("-", "") && Number(parts) >= 16)),
  );
  if (!eligible.length) return null;
  return eligible.at(-1).date;
}
export function extractSeries(raw, expectedDates) {
  const rows = raw?.data?.item;
  if (!Array.isArray(rows)) return { error: "日线结构缺失" };
  const sorted = [...rows].sort((a, b) => a.date_ms - b.date_ms);
  if (new Set(sorted.map((x) => chinaDay(x.date_ms))).size !== sorted.length)
    return { error: "日线日期重复，拒绝静默去重" };
  const selected = expectedDates.map((d) =>
    sorted.find((x) => compactDay(x.date_ms) === d),
  );
  if (selected.some((x) => !x))
    return { error: "交易日历窗口内存在缺失日线（可能停牌或源缺失）" };
  if (selected.some((x) => !finite(x.close_price) || x.close_price <= 0))
    return { error: "收盘价空值、非数值或非正值" };
  return { rows: selected };
}
export function calculateEvidence(sources, input, now = Date.now()) {
  const evidence = [];
  const warnings = [];
  const source = (id) => sources.find((s) => s.id === id);
  const push = (
    id,
    label,
    value,
    unit,
    formula,
    ids,
    fields,
    quality = "valid",
    reason = "",
  ) =>
    evidence.push({
      id,
      label,
      value,
      unit,
      formula,
      source_ids: ids,
      fields,
      quality,
      reason,
    });
  const cal = source("calendar");
  const close = cal?.ok ? expectedClose(cal.raw?.data?.item || [], now) : null;
  const dates = close
    ? (cal.raw.data.item || [])
        .filter((x) => x.date <= close)
        .slice(-(input.window + 1))
        .map((x) => x.date)
    : [];
  if (!close || dates.length !== input.window + 1)
    warnings.push("交易日历不足，无法建立完整的交易日窗口。");
  const stock = source("history"),
    benchmark = source("benchmark");
  const a =
    stock?.ok && dates.length === input.window + 1
      ? extractSeries(stock.raw, dates)
      : { error: "个股日线或交易日历调用失败" };
  const b =
    benchmark?.ok && dates.length === input.window + 1
      ? extractSeries(benchmark.raw, dates)
      : { error: "指数日线或交易日历调用失败" };
  if (a.rows) {
    const rows = a.rows;
    const r = (rows.at(-1).close_price / rows[0].close_price - 1) * 100;
    push(
      "E1",
      `${input.window} 日个股涨跌幅`,
      r,
      "%",
      `(末日收盘价 / 起日收盘价 − 1) × 100；${dates[0]}–${close}，${input.window} 个区间、${input.window + 1} 根日线；个股前复权`,
      ["history", "calendar"],
      ["data.item[].close_price", "data.item[].date_ms"],
    );
    if (b.rows) {
      const ir = (b.rows.at(-1).close_price / b.rows[0].close_price - 1) * 100;
      push(
        "E2",
        `${input.window} 日相对沪深 300`,
        r - ir,
        "百分点",
        "个股区间涨跌幅 − 沪深 300 同一交易日窗口涨跌幅（指数不复权）",
        ["history", "benchmark", "calendar"],
        ["data.item[].close_price", "data.item[].date_ms"],
      );
    } else
      push(
        "E2",
        "相对沪深 300",
        null,
        "百分点",
        "两序列须逐日对齐",
        ["history", "benchmark", "calendar"],
        [],
        "missing",
        b.error,
      );
    const turns = rows.slice(1).map((x) => x.turnover);
    if (
      turns.every((x) => finite(x) && x >= 0) &&
      turns.slice(0, -1).some((x) => x > 0)
    ) {
      const avg =
        turns.slice(0, -1).reduce((s, v) => s + v, 0) / (turns.length - 1);
      push(
        "E3",
        "末日成交额 / 前序日均",
        turns.at(-1) / avg,
        "倍",
        `末日成交额 / 此窗口前 ${input.window - 1} 个交易日日均成交额；CNY / CNY，不是量比或成交量倍数`,
        ["history", "calendar"],
        ["data.item[].turnover"],
      );
    } else
      push(
        "E3",
        "成交额比",
        null,
        "倍",
        "成交额须非负且分母大于零",
        ["history"],
        ["data.item[].turnover"],
        "missing",
        "成交额字段缺失或分母为零",
      );
  } else {
    push(
      "E1",
      "区间涨跌幅",
      null,
      "%",
      "需完整交易日窗口",
      ["history", "calendar"],
      [],
      "missing",
      a.error,
    );
    push(
      "E2",
      "相对沪深 300",
      null,
      "百分点",
      "需完整对齐交易日窗口",
      ["history", "benchmark", "calendar"],
      [],
      "missing",
      a.error,
    );
    push(
      "E3",
      "成交额比",
      null,
      "倍",
      "需完整窗口",
      ["history", "calendar"],
      [],
      "missing",
      a.error,
    );
  }
  const valuation = source("valuation");
  const v = valuation?.raw?.data?.item?.find((x) => x.thscode === input.symbol);
  const pe = v?.pe_ttm;
  const vDay = finite(valuation?.raw?.data?.timestamp)
    ? compactDay(valuation.raw.data.timestamp)
    : null;
  const pq =
    !valuation?.ok || !finite(pe)
      ? "missing"
      : !vDay || !close || vDay < close
        ? "stale"
        : pe <= 0
          ? "invalid"
          : "valid";
  push(
    "E4",
    "市盈率 TTM",
    finite(pe) ? pe : null,
    "倍",
    "当前快照市盈率 TTM；不代表历史分位或合理估值",
    ["valuation"],
    ["data.item[].pe_ttm", "data.timestamp"],
    pq,
    pq === "invalid"
      ? "PE 非正，不能按常规市盈率解释"
      : pq === "stale"
        ? "估值时点落后或无法验证时效"
        : pq === "missing"
          ? "估值调用或字段缺失"
          : "",
  );
  const snap = source("snapshot");
  const s = snap?.raw?.data?.item?.find((x) => x.thscode === input.symbol);
  const time = snap?.raw?.data?.timestamp;
  push(
    "E5",
    "行情涨跌幅",
    finite(s?.price_change_ratio_pct) ? s.price_change_ratio_pct : null,
    "%",
    "快照相对前收盘价的涨跌幅（百分比数值）",
    ["snapshot"],
    ["data.item[].price_change_ratio_pct", "data.timestamp"],
    !snap?.ok || !finite(s?.price_change_ratio_pct)
      ? "missing"
      : !close || !finite(time) || compactDay(time) < close
        ? "stale"
        : "valid",
    "需结合数据时点解读；快照与区间涨跌幅不同",
  );
  const ifind = source("ifind");
  const inner = parseIfind(ifind?.raw);
  const rows = inner?.data?.tables;
  let corroboration = {
    status: "unavailable",
    message: "iFinD 未获得可核对报价；保留单源风险。",
  };
  if (Array.isArray(rows) && rows.length > 1) {
    const headers = rows[0],
      row = rows.find((r, i) => i > 0 && r[0] === input.symbol);
    const pi = headers.indexOf("最新价");
    const ti = headers.indexOf("time");
    if (
      row &&
      pi >= 0 &&
      row[pi] !== null &&
      row[pi] !== "" &&
      Number.isFinite(Number(row[pi]))
    ) {
      const price = Number(row[pi]);
      const timeText = ti >= 0 ? row[ti] : null;
      const dayMatch =
        timeText && finite(time) && timeText.slice(0, 10) === chinaDay(time);
      const delta = finite(s?.last_price)
        ? Math.abs(price - s.last_price)
        : null;
      corroboration = !dayMatch
        ? {
            status: "time_mismatch",
            message: "两源报价数据日期不一致或时点未知，拒绝做一致性判断。",
          }
        : delta === null
          ? { status: "unavailable", message: "扶摇报价缺失，无法交叉核验。" }
          : delta > Math.max(0.01, s.last_price * 0.001)
            ? {
                status: "conflict",
                message: `两源最新价差异 ${delta.toFixed(4)} 元，超过 0.1% 或 0.01 元阈值；请核对采样时点。`,
              }
            : {
                status: "aligned",
                message:
                  "同日两源最新价在 0.1% / 0.01 元容差内；同日不等于同一秒，亦不代表独立数据源。",
              };
      push(
        "E6",
        "iFinD 最新价",
        price,
        "CNY",
        "服务返回的最新价；仅用于同日报价交叉检查",
        ["ifind"],
        ["result.content[].text → data.tables"],
        "valid",
        timeText || "源时点未知",
      );
    }
  }
  if (corroboration.status === "conflict") {
    for (const e of evidence)
      if (e.id === "E5") {
        e.quality = "conflict";
        e.reason = corroboration.message;
      }
    warnings.push(corroboration.message);
  }
  for (const s of sources) if (!s.ok) warnings.push(`${s.label}：${s.error}`);
  if (!["aligned"].includes(corroboration.status))
    warnings.push(corroboration.message);
  return {
    evidence,
    warnings,
    corroboration,
    period: {
      start: dates[0] || null,
      end: close,
      dates,
      window: input.window,
    },
    series: a.rows || [],
  };
}
export function parseIfind(raw) {
  for (const c of raw?.result?.content || []) {
    if (c.type === "text") {
      try {
        return JSON.parse(c.text);
      } catch {}
    }
  }
  return null;
}
export function judgeClaims(plan, evidence) {
  const map = {
    return: "E1",
    relative_return: "E2",
    turnover_ratio: "E3",
    pe_ttm: "E4",
    price_change: "E5",
  };
  return plan.claims.map((c) => {
    const eid = map[c.metric],
      e = evidence.find((x) => x.id === eid);
    let verdict = "unknown",
      reason = "当前工具和口径无法验证此主张。";
    if (c.metric === "causality")
      reason = "行情相关性不能证明因果；尚缺公告原文、事件时序和替代解释检验。";
    else if (e && e.quality !== "valid")
      reason = e.reason || "原始证据缺失或不满足质量要求，拒绝生成正常结论。";
    else if (e && c.operator !== "unknown" && finite(e.value)) {
      const ok =
        c.operator === "gt"
          ? e.value > c.threshold
          : c.operator === "lt"
            ? e.value < c.threshold
            : Math.abs(e.value - c.threshold) <= 0.01;
      verdict = ok ? "supported" : "contradicted";
      reason = `按已确认口径，${e.label}为 ${e.value.toFixed(2)} ${e.unit}，${ok ? "满足" : "不满足"}原文条件。`;
    } else if (e)
      reason = "指标可取数，但原文缺少清晰比较阈值；需要人工明确后重跑。";
    return {
      ...c,
      verdict,
      reason,
      evidence_ids: e ? [eid] : [],
      review: "pending",
      review_note: "",
    };
  });
}
export const planTools = (claims) => [
  ...new Set(
    claims.flatMap(
      (c) =>
        ({
          return: ["calendar", "history"],
          relative_return: ["calendar", "history", "benchmark"],
          turnover_ratio: ["calendar", "history"],
          pe_ttm: ["calendar", "valuation"],
          price_change: ["calendar", "snapshot", "ifind"],
          causality: [],
          unsupported: [],
        })[c.metric] || [],
    ),
  ),
];
