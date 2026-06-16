/**
 * ACA-governed CheckpointSaver for LangGraph.js
 *
 * Wraps LangGraph's BaseCheckpointSaver to add ACA governance:
 * - source_tier tracking (raw_source / llm_derived / human_confirmed)
 * - provenance_chain for every checkpoint
 * - namespace isolation per thread
 * - audit trail of all state changes
 * - supersede policy (old checkpoints marked, not deleted)
 */
import { createStore } from "@chibakuma/agent-memory-hall";
import type { AmhStore, AmhRecord } from "@chibakuma/agent-memory-hall";
import { randomUUID } from "node:crypto";

export interface AcaCheckpointConfig {
  storeType?: "sqlite" | "json";
  storePath?: string;
  agentId?: string;
  namespace?: string;
  defaultTier?: "raw_source" | "llm_derived" | "human_confirmed";
}

interface CheckpointEntry {
  threadId: string;
  checkpointNs: string;
  checkpointId: string;
  parentCheckpointId?: string;
  checkpoint: unknown;
  metadata: unknown;
  createdAt: string;
}

interface WriteEntry {
  threadId: string;
  checkpointNs: string;
  checkpointId: string;
  taskId: string;
  channel: string;
  value: unknown;
  idx: number;
}

export class AcaCheckpointSaver {
  private store: AmhStore;
  private agentId: string;
  private namespace: string;
  private defaultTier: "raw_source" | "llm_derived" | "human_confirmed";

  constructor(config: AcaCheckpointConfig = {}) {
    this.store = createStore({
      storeType: config.storeType ?? "sqlite",
      storePath: config.storePath,
    });
    this.agentId = config.agentId ?? "langgraph";
    this.namespace = config.namespace ?? "langgraph:default";
    this.defaultTier = config.defaultTier ?? "llm_derived";
  }

  private memoryId(threadId: string, checkpointId: string): string {
    return `lg:${threadId}:${checkpointId}`;
  }

  private writeMemoryId(threadId: string, checkpointId: string, taskId: string, idx: number): string {
    return `lgw:${threadId}:${checkpointId}:${taskId}:${idx}`;
  }

  async getTuple(config: { configurable?: { thread_id?: string; checkpoint_ns?: string; checkpoint_id?: string } }): Promise<CheckpointEntry | undefined> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return undefined;

    const checkpointId = config.configurable?.checkpoint_id;

    if (checkpointId) {
      const record = await this.store.get(this.memoryId(threadId, checkpointId));
      if (!record) return undefined;
      return this.recordToEntry(record);
    }

    const records = await this.store.query({
      namespace: this.namespace,
      agent_id: this.agentId,
      text: `lg:${threadId}:`,
      limit: 1,
    });

    if (records.length === 0) return undefined;

    const sorted = records.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return this.recordToEntry(sorted[0]);
  }

  async *list(
    config: { configurable?: { thread_id?: string; checkpoint_ns?: string } },
    options?: { limit?: number; before?: { configurable?: { checkpoint_id?: string } } },
  ): AsyncGenerator<CheckpointEntry> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return;

    const records = await this.store.query({
      namespace: this.namespace,
      agent_id: this.agentId,
      text: `lg:${threadId}:`,
      limit: options?.limit ?? 100,
    });

    const sorted = records.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const beforeId = options?.before?.configurable?.checkpoint_id;

    for (const record of sorted) {
      if (beforeId && record.memory_id >= this.memoryId(threadId, beforeId)) continue;
      yield this.recordToEntry(record);
    }
  }

  async put(
    config: { configurable?: { thread_id?: string; checkpoint_ns?: string; checkpoint_id?: string } },
    checkpoint: unknown,
    metadata: unknown,
  ): Promise<{ configurable: { thread_id: string; checkpoint_ns: string; checkpoint_id: string } }> {
    const threadId = config.configurable?.thread_id ?? randomUUID();
    const checkpointNs = config.configurable?.checkpoint_ns ?? "";
    const checkpointId = (checkpoint as { id?: string })?.id ?? randomUUID();

    const memId = this.memoryId(threadId, checkpointId);
    const parentCheckpointId = config.configurable?.checkpoint_id;

    const record: AmhRecord = {
      amh_version: "0.1",
      memory_id: memId,
      version: 1,
      status: "active",
      agent_id: this.agentId,
      namespace: this.namespace,
      memory_type: "fact",
      content: {
        format: "application/json",
        value: JSON.stringify({
          type: "langgraph_checkpoint",
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: checkpointId,
          parent_checkpoint_id: parentCheckpointId,
          checkpoint,
          metadata,
        }),
      },
      source: {
        type: "agent",
        ref: `langgraph:${threadId}`,
        tier: this.defaultTier,
      },
      created_at: new Date().toISOString(),
      created_by: this.agentId,
    };

    if (parentCheckpointId) {
      record.supersedes = this.memoryId(threadId, parentCheckpointId);
      record.provenance_chain = {
        origin: {
          memory_id: this.memoryId(threadId, parentCheckpointId),
          agent_id: this.agentId,
          namespace: this.namespace,
          tier: this.defaultTier,
          created_at: record.created_at,
        },
        transitions: [{
          type: "supersede",
          from_memory_id: this.memoryId(threadId, parentCheckpointId),
          to_memory_id: memId,
          performed_by: this.agentId,
          performed_at: record.created_at,
          tier_before: this.defaultTier,
          tier_after: this.defaultTier,
        }],
      };
    }

    await this.store.put(record);
    await this.store.appendAudit({
      event_id: randomUUID(),
      memory_id: memId,
      operation: "write",
      principal_id: this.agentId,
      timestamp: record.created_at,
      details: `LangGraph checkpoint for thread ${threadId}`,
    });

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpointId,
      },
    };
  }

  async putWrites(
    config: { configurable?: { thread_id?: string; checkpoint_ns?: string; checkpoint_id?: string } },
    writes: [string, unknown][],
    taskId: string,
  ): Promise<void> {
    const threadId = config.configurable?.thread_id ?? "";
    const checkpointId = config.configurable?.checkpoint_id ?? "";

    for (let i = 0; i < writes.length; i++) {
      const [channel, value] = writes[i];
      const memId = this.writeMemoryId(threadId, checkpointId, taskId, i);

      const existing = await this.store.get(memId);
      if (existing) continue;

      await this.store.put({
        amh_version: "0.1",
        memory_id: memId,
        version: 1,
        status: "active",
        agent_id: this.agentId,
        namespace: this.namespace,
        memory_type: "fact",
        content: {
          format: "application/json",
          value: JSON.stringify({
            type: "langgraph_write",
            thread_id: threadId,
            checkpoint_id: checkpointId,
            task_id: taskId,
            channel,
            value,
            idx: i,
          }),
        },
        source: {
          type: "agent",
          ref: `langgraph:${threadId}:${taskId}`,
          tier: this.defaultTier,
        },
        created_at: new Date().toISOString(),
        created_by: this.agentId,
      });
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    const records = await this.store.query({
      namespace: this.namespace,
      agent_id: this.agentId,
      text: `lg:${threadId}:`,
      limit: 1000,
    });

    for (const record of records) {
      await this.store.delete(record.memory_id);
      await this.store.appendAudit({
        event_id: randomUUID(),
        memory_id: record.memory_id,
        operation: "revoke",
        principal_id: this.agentId,
        timestamp: new Date().toISOString(),
        details: `Thread ${threadId} deleted`,
      });
    }
  }

  private recordToEntry(record: AmhRecord): CheckpointEntry {
    const parsed = JSON.parse(record.content.value);
    return {
      threadId: parsed.thread_id,
      checkpointNs: parsed.checkpoint_ns ?? "",
      checkpointId: parsed.checkpoint_id,
      parentCheckpointId: parsed.parent_checkpoint_id,
      checkpoint: parsed.checkpoint,
      metadata: parsed.metadata,
      createdAt: record.created_at,
    };
  }
}
