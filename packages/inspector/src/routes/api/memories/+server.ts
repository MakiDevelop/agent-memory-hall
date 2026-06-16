import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getStore } from "$lib/server/store";

export const GET: RequestHandler = async ({ url }) => {
  const store = getStore();
  if (!store) {
    return json({ mode: "seed", memories: [] }, { status: 200 });
  }

  const namespace = url.searchParams.get("namespace") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const memoryType = url.searchParams.get("memory_type") ?? undefined;
  const agentId = url.searchParams.get("agent_id") ?? undefined;
  const text = url.searchParams.get("q") ?? undefined;
  const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);

  const memories = await store.query({
    namespace,
    status: status as any,
    memory_type: memoryType as any,
    agent_id: agentId,
    text,
    limit,
  });

  return json({ mode: "live", memories });
};
