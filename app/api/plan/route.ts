import { signPlan } from "@/lib/plan-ticket.mjs";
import { createPlan } from "@/lib/model.mjs";
import { validateInput } from "@/lib/proof-engine.mjs";
import { readBody, apiResponse, safeError } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const input = validateInput(body.input);
    const env = getRuntime();
    const plan = await createPlan(input, env, body.llm || {});
    return apiResponse({
      ok: true,
      plan,
      ticket: await signPlan(plan, env.PLAN_SIGNING_SECRET),
    });
  } catch (e) {
    return safeError(e);
  }
}
