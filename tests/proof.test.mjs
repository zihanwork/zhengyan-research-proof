import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  chinaDay,
  calculateEvidence,
  judgeClaims,
  validatePlan,
  validateInput,
  compliance,
  expectedClose,
  extractSeries,
  DAY,
} from "../lib/proof-engine.mjs";
import { createPlan, modelConfig } from "../lib/model.mjs";
import { collectSources } from "../lib/data.mjs";
import { signPlan, readPlan } from "../lib/plan-ticket.mjs";
const sample = JSON.parse(
  fs.readFileSync(new URL("../data/sample-run.json", import.meta.url)),
);
const now = Date.parse(sample.created_at);
const clone = () => structuredClone(sample);
const calc = (s) => calculateEvidence(s.sources, s.input, now);

test("真实快照：六路原始响应保留，计算结果与原始字段独立复算一致", () => {
  const s = clone();
  const r = calc(s);
  const close = r.series.map((x) => x.close_price);
  const ret = (close.at(-1) / close[0] - 1) * 100;
  assert.equal(r.evidence.find((x) => x.id === "E1").value, ret);
  assert.equal(r.series.length, s.input.window + 1);
  assert.equal(s.sources.length, 6);
  for (const e of r.evidence) {
    assert.ok(e.source_ids.length > 0);
    assert.ok(e.fields.length > 0);
  }
});
test("证据与主张：支持、不支持、因果未知均保留", () => {
  const s = clone();
  const r = calc(s);
  const claims = judgeClaims(s.plan, r.evidence);
  assert.ok(claims.some((c) => c.verdict === "supported"));
  assert.ok(claims.some((c) => c.verdict === "contradicted"));
  assert.equal(claims.find((c) => c.metric === "causality").verdict, "unknown");
});
test("接口失败：不保留上次相对表现结论", () => {
  const s = clone();
  Object.assign(
    s.sources.find((x) => x.id === "benchmark"),
    { ok: false, error: "HTTP 504", raw: null },
  );
  const r = calc(s);
  assert.equal(r.evidence.find((e) => e.id === "E2").value, null);
  assert.equal(
    judgeClaims(s.plan, r.evidence).find((c) => c.metric === "relative_return")
      .verdict,
    "unknown",
  );
});
test("缺失交易日：拒绝以不完整窗口计算", () => {
  const s = clone();
  s.sources.find((x) => x.id === "history").raw.data.item = s.sources
    .find((x) => x.id === "history")
    .raw.data.item.filter(
      (x) =>
        !s.period.dates.includes(
          new Date(x.date_ms)
            .toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
            .replaceAll("-", ""),
        ),
    );
  const r = calc(s);
  assert.equal(r.evidence.find((x) => x.id === "E1").value, null);
});
test("重复日线：不静默去重", () => {
  const s = clone();
  const source = s.sources.find((x) => x.id === "history");
  source.raw.data.item.push(source.raw.data.item.at(-1));
  assert.equal(calc(s).evidence.find((x) => x.id === "E1").quality, "missing");
});
test("PE null 不是 0，负值不作低估解释", () => {
  for (const value of [null, -8]) {
    const s = clone();
    s.sources.find((x) => x.id === "valuation").raw.data.item[0].pe_ttm = value;
    const e = calc(s).evidence.find((x) => x.id === "E4");
    assert.equal(e.quality, value === null ? "missing" : "invalid");
    assert.equal(
      judgeClaims(s.plan, [e]).find((c) => c.metric === "pe_ttm").verdict,
      "unknown",
    );
  }
});
test("过期估值：数值展示但结论降为未知", () => {
  const s = clone();
  s.sources.find((x) => x.id === "valuation").raw.data.timestamp =
    now - 30 * DAY;
  const r = calc(s);
  assert.equal(r.evidence.find((x) => x.id === "E4").quality, "stale");
  assert.equal(
    judgeClaims(s.plan, r.evidence).find((c) => c.metric === "pe_ttm").verdict,
    "unknown",
  );
});
test("报价冲突：保留冲突状态，不生成正常行情结论", () => {
  const s = clone();
  const source = s.sources.find((x) => x.id === "ifind");
  const inner = JSON.parse(source.raw.result.content[0].text);
  inner.data.tables[1][2] =
    chinaDay(s.sources.find((x) => x.id === "snapshot").raw.data.timestamp) +
    " 15:00:00";
  inner.data.tables[1][3] = "9999";
  source.raw.result.content[0].text = JSON.stringify(inner);
  const r = calc(s);
  assert.equal(r.corroboration.status, "conflict");
  assert.equal(r.evidence.find((x) => x.id === "E5").quality, "conflict");
});
test("成交额分母为零：不生成无穷值", () => {
  const s = clone();
  s.sources
    .find((x) => x.id === "history")
    .raw.data.item.forEach((x) => (x.turnover = 0));
  assert.equal(calc(s).evidence.find((x) => x.id === "E3").value, null);
});
test("正常零涨跌幅：零值是有效数据", () => {
  const s = clone();
  s.sources.find(
    (x) => x.id === "snapshot",
  ).raw.data.item[0].price_change_ratio_pct = 0;
  const e = calc(s).evidence.find((x) => x.id === "E5");
  assert.equal(e.value, 0);
  assert.equal(e.quality, "valid");
});
test("交易日盘中用前一交易日，16时后用当日", () => {
  const cal = [{ date: "20261027" }, { date: "20261028" }];
  assert.equal(
    expectedClose(cal, Date.parse("2026-10-28T10:00:00+08:00")),
    "20261027",
  );
  assert.equal(
    expectedClose(cal, Date.parse("2026-10-28T17:00:00+08:00")),
    "20261028",
  );
});
test("合规边界：禁止交易建议、保证收益和确定性预测", () => {
  for (const text of [
    "建议现在买入贵州茅台",
    "保证收益",
    "贵州茅台明天必涨",
    "满仓抄底",
    "buy 600519",
  ])
    assert.equal(compliance(text), true, text);
  assert.equal(compliance("近5个交易日跑赢沪深300"), false);
  assert.throws(
    () => validateInput({ ...sample.input, text: "建议买入" }),
    /合规拦截/,
  );
});
test("输入边界：证券代码、窗口与字数", () => {
  assert.throws(() =>
    validateInput({ ...sample.input, symbol: "../../etc/passwd" }),
  );
  assert.throws(() => validateInput({ ...sample.input, window: 999 }));
  assert.throws(() =>
    validateInput({ ...sample.input, text: "A".repeat(1601) }),
  );
});
test("模型幻觉：非原文主张、未注册指标、数值字符串均拒绝", () => {
  for (const c of [
    { text: "不存在的原文", metric: "return", operator: "gt", threshold: 0 },
    {
      text: "市盈率TTM低于25倍",
      metric: "execute_trade",
      operator: "gt",
      threshold: 0,
    },
    {
      text: "市盈率TTM低于25倍",
      metric: "pe_ttm",
      operator: "lt",
      threshold: "25",
    },
  ])
    assert.throws(() => validatePlan({ claims: [c] }, sample.input));
});
test("LLM 协议契约：模拟合法 JSON 可生成可执行计划（不是实际模型验证）", async () => {
  const f = async () =>
    Response.json({
      id: "mock-id",
      model: "test-model",
      usage: { total_tokens: 100 },
      choices: [
        {
          message: { content: JSON.stringify({ claims: sample.plan.claims }) },
        },
      ],
    });
  const plan = await createPlan(
    sample.input,
    { LLM_API_KEY: "test-secret", LLM_MODEL: "test-model" },
    {},
    f,
  );
  assert.equal(plan.claims.length, 4);
  assert.equal(plan.model_record.model, "test-model");
  assert.ok(!JSON.stringify(plan).includes("test-secret"));
});
test("LLM 失败：不回退为假 AI 计划", async () => {
  await assert.rejects(() => createPlan(sample.input, {}, {}), /模型未配置/);
  const f = async () => new Response("bad", { status: 503 });
  await assert.rejects(
    () =>
      createPlan(sample.input, { LLM_API_KEY: "key", LLM_MODEL: "m" }, {}, f),
    /HTTP 503/,
  );
});
test("模型地址 SSRF：拒绝本地与任意客户端 URL", () => {
  for (const baseUrl of [
    "http://127.0.0.1/v1",
    "https://evil.example/v1",
    "https://api.openai.com:8443/v1",
  ])
    assert.throws(() =>
      modelConfig({}, { apiKey: "key", model: "m", baseUrl }),
    );
});
test("HTTP 200 + 非零业务码：五路扶摇均作为失败，无静默成功、无重试", async () => {
  let count = 0;
  const f = async () => {
    count++;
    return Response.json({ code: 4001, message: "rate limited", data: null });
  };
  const sources = await collectSources(
    sample.input,
    { FUYAO_API_KEY: "fake-test-key" },
    f,
    now,
  );
  assert.equal(count, 5);
  assert.equal(sources.filter((s) => s.ok).length, 0);
  assert.equal(sources.length, 6);
  assert.ok(sources.some((s) => s.error.includes("4001")));
  assert.ok(!JSON.stringify(sources).includes("fake-test-key"));
});
test("HMAC 计划票据：有效可读，篡改或密钥不一致拒绝", async () => {
  const ticket = await signPlan(sample.plan, "a-long-test-only-secret");
  assert.deepEqual(
    await readPlan(ticket, "a-long-test-only-secret"),
    sample.plan,
  );
  await assert.rejects(() => readPlan(ticket, "other-key"));
  const [payload, signature] = ticket.split(".");
  await assert.rejects(() =>
    readPlan(payload + "x." + signature, "a-long-test-only-secret"),
  );
});
