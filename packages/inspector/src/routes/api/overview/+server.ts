import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getStore, isLiveMode } from "$lib/server/store";

export const GET: RequestHandler = async ({ url }) => {
  const store = getStore();
  if (!store) {
    return json({ mode: "seed", message: "No AMH store configured. Using seed data." }, { status: 200 });
  }

  const namespace = url.searchParams.get("namespace") ?? undefined;
  const memories = await store.list(namespace);
  const auditEvents: Array<{ operation: string }> = [];

  for (const mem of memories.slice(0, 50)) {
    const events = await store.getAudit(mem.memory_id);
    auditEvents.push(...events);
  }

  const tierCounts = { raw_source: 0, llm_derived: 0, human_confirmed: 0 };
  const statusCounts = { active: 0, superseded: 0, revoked: 0, expired: 0 };

  for (const mem of memories) {
    const tier = mem.source.tier as keyof typeof tierCounts;
    if (tier in tierCounts) tierCounts[tier]++;
    const status = mem.status as keyof typeof statusCounts;
    if (status in statusCounts) statusCounts[status]++;
  }

  const governanceSensitiveOps = new Set(["revoke", "supersede", "tier_upgrade", "transfer", "rejected"]);
  const governanceSensitiveCount = auditEvents.filter(e => governanceSensitiveOps.has(e.operation)).length;

  return json({
    mode: "live",
    totalMemories: memories.length,
    totalAuditEvents: auditEvents.length,
    governanceSensitiveCount,
    tierCounts,
    statusCounts,
    namespaces: await store.namespaces(),
  });
};
