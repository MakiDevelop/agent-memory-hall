import type { AmhStore } from "../store/interface.js";
import type { AmhRecord } from "../schema/types.js";
import { writeMemory, type WriteResult } from "./write.js";
import { queryMemories, type ReadContext } from "./read.js";
import type { WriteGateConfig, WriteGateContext } from "../governance/write-gate.js";

export interface KnowledgeWriteInput {
  agent_id: string;
  namespace: string;
  content: string;
  /** fact (default) or constraint */
  memory_type?: "fact" | "constraint";
  /** parent memory_id to supersede */
  supersedes?: string;
  /** if set and supersedes empty, find latest active fact containing this text in ns */
  replaces_text?: string;
  source_ref?: string;
  /** default human_confirmed when superseding (anti-ouroboros) */
  source_tier?: AmhRecord["source"]["tier"];
}

/**
 * Minimal Knowledge handler: durable fact/constraint with optional supersede.
 * Supersede defaults to human_confirmed tier so llm cannot ouroboros llm.
 */
export async function writeKnowledge(
  input: KnowledgeWriteInput,
  store: AmhStore,
  gateConfig?: Partial<WriteGateConfig>,
  gateContext?: WriteGateContext
): Promise<WriteResult & { superseded?: string }> {
  let supersedes = input.supersedes;
  if (!supersedes && input.replaces_text) {
    const hits = await queryMemories(
      {
        namespace: input.namespace,
        memory_type: input.memory_type ?? "fact",
        text: input.replaces_text,
        limit: 10,
      },
      store,
      { ...gateContext, namespaceIsolation: gateConfig?.namespaceIsolation, filterInactive: true }
    );
    const match = hits.find((h) =>
      h.content.value.toLowerCase().includes(input.replaces_text!.toLowerCase())
    );
    if (match) supersedes = match.memory_id;
  }

  const tier =
    input.source_tier ??
    (supersedes ? "human_confirmed" : "llm_derived");

  const body = input.content.trim().startsWith("[knowledge")
    ? input.content
    : `[knowledge] ${input.content}`;

  const result = await writeMemory(
    {
      agent_id: input.agent_id,
      namespace: input.namespace,
      memory_type: input.memory_type ?? "fact",
      content: body,
      source_type: tier === "human_confirmed" ? "human" : "agent",
      source_ref: input.source_ref ?? "knowledge",
      source_tier: tier,
      supersedes,
    },
    store,
    gateConfig,
    gateContext
  );

  return { ...result, superseded: supersedes };
}

export async function listActiveKnowledge(
  namespace: string,
  store: AmhStore,
  context: ReadContext = {},
  limit = 20
): Promise<AmhRecord[]> {
  // chronological facts/constraints (no text = list path)
  const facts = await queryMemories(
    { namespace, memory_type: "fact", limit },
    store,
    context
  );
  const constraints = await queryMemories(
    { namespace, memory_type: "constraint", limit },
    store,
    context
  );
  return [...facts, ...constraints]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
}
