import sample from "@/data/sample-run.json";
import { apiResponse } from "@/lib/api";
export function GET() {
  return apiResponse({ ok: true, run: sample });
}
