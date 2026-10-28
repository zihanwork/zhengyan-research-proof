import fs from "node:fs";
import { collectSources } from "../lib/data.mjs";
import {
  calculateEvidence,
  judgeClaims,
  validatePlan,
} from "../lib/proof-engine.mjs";
const input = {
  symbol: "600519.SH",
  window: 5,
  text: "贵州茅台近5个交易日跑赢沪深300。末日成交额高于窗口前序日均。市盈率TTM低于25倍。这可能与政策催化有关。",
};
const env = Object.fromEntries(
  fs
    .readFileSync(".dev.vars", "utf8")
    .trim()
    .split("\n")
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), JSON.parse(l.slice(i + 1))];
    }),
);
const sources = await collectSources(input, env);
const parsed = {
  claims: [
    {
      text: "贵州茅台近5个交易日跑赢沪深300",
      metric: "relative_return",
      operator: "gt",
      threshold: 0,
    },
    {
      text: "末日成交额高于窗口前序日均",
      metric: "turnover_ratio",
      operator: "gt",
      threshold: 1,
    },
    {
      text: "市盈率TTM低于25倍",
      metric: "pe_ttm",
      operator: "lt",
      threshold: 25,
    },
    {
      text: "这可能与政策催化有关",
      metric: "causality",
      operator: "unknown",
      threshold: null,
    },
  ],
};
const plan = validatePlan(parsed, input);
const calculated = calculateEvidence(sources, input);
const run = {
  id: "sample-20261029-01",
  mode: "replay",
  created_at: new Date().toISOString(),
  input,
  plan,
  claims: judgeClaims(plan, calculated.evidence),
  sources,
  ...calculated,
  model_record: null,
  planning_note:
    "示例主张由开发者预先标注，用于真实数据回放；不声称为在线模型生成。",
  review_log: [],
  schema_version: "1.0",
};
fs.writeFileSync("data/sample-run.json", JSON.stringify(run, null, 2));
console.log(
  JSON.stringify({
    sources: sources.map((s) => ({ id: s.id, ok: s.ok, error: s.error })),
    evidence: run.evidence.map((e) => ({
      id: e.id,
      value: e.value,
      quality: e.quality,
    })),
    period: run.period,
    claims: run.claims.map((c) => c.verdict),
  }),
);
