import { getRuntime } from "@/lib/runtime";
import { apiResponse } from "@/lib/api";
export function GET() {
  const e = getRuntime();
  return apiResponse({
    fuyao: Boolean(e.FUYAO_API_KEY),
    ifind: Boolean(e.IFIND_API_KEY),
    model: Boolean(e.LLM_API_KEY && e.LLM_MODEL),
    model_name: e.LLM_MODEL || null,
    server_time: new Date().toISOString(),
  });
}
