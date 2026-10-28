import { AsyncLocalStorage } from "node:async_hooks";
const runtime = new AsyncLocalStorage<Record<string, string>>();
export const withRuntime = <T>(env: unknown, fn: () => T) =>
  runtime.run(env as Record<string, string>, fn);
export const getRuntime = () => ({ ...process.env, ...runtime.getStore() });
