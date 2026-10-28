import { readPlan } from "@/lib/plan-ticket.mjs";
import sample from "@/data/sample-run.json";
import {
  validateInput,
  validatePlan,
  calculateEvidence,
  judgeClaims,
} from "@/lib/proof-engine.mjs";
import { collectSources } from "@/lib/data.mjs";
import { readBody, apiResponse, safeError } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const env = getRuntime();
    const rawPlan = body.sample_only
      ? (sample as any).plan
      : await readPlan(body.ticket, env.PLAN_SIGNING_SECRET);
    const input = validateInput(
      body.sample_only ? (sample as any).input : body.input,
    );
    if (["text", "symbol", "window"].some((k) => rawPlan.input[k] !== input[k]))
      throw new Error("输入已变化，请重新生成计划");
    const plan = validatePlan(rawPlan, input);
    const sources = await collectSources(input, getRuntime());
    const calculated = calculateEvidence(sources, input);
    const claims = judgeClaims(plan, calculated.evidence);
    const run = {
      id: crypto.randomUUID(),
      mode: body.sample_only ? "live_fixed" : "live",
      created_at: new Date().toISOString(),
      input,
      plan,
      claims,
      sources,
      ...calculated,
      model_record: body.sample_only ? null : rawPlan.model_record || null,
      planning_note: body.sample_only
        ? "固定示例规划（开发者标注），此次仅刷新真实证据，未调用 LLM。"
        : null,
      review_log: [],
      schema_version: "1.0",
    };
    return apiResponse({ ok: true, run });
  } catch (e) {
    return safeError(e);
  }
}
