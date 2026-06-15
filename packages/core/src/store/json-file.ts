import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AmhStore } from "./interface.js";
import type { AmhRecord, AuditEvent, AmhQuery } from "../schema/types.js";

interface StoreData {
  records: AmhRecord[];
  audit: AuditEvent[];
}

export class JsonFileStore implements AmhStore {
  private data: StoreData = { records: [], audit: [] };
  private loaded = false;

  constructor(private filePath?: string) {
    this.filePath = filePath ?? join(homedir(), ".amh", "memory.json");
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath!, "utf-8");
      this.data = JSON.parse(raw) as StoreData;
    } catch {
      this.data = { records: [], audit: [] };
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    const dir = dirname(this.filePath!);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(this.filePath!, JSON.stringify(this.data, null, 2), "utf-8");
  }

  async put(record: AmhRecord): Promise<void> {
    await this.load();
    const idx = this.data.records.findIndex(
      (r) => r.memory_id === record.memory_id
    );
    if (idx >= 0) {
      this.data.records[idx] = record;
    } else {
      this.data.records.push(record);
    }
    await this.save();
  }

  async get(memoryId: string): Promise<AmhRecord | null> {
    await this.load();
    return this.data.records.find((r) => r.memory_id === memoryId) ?? null;
  }

  async query(filter: AmhQuery): Promise<AmhRecord[]> {
    await this.load();
    let results = this.data.records;

    if (filter.memory_id) {
      results = results.filter((r) => r.memory_id === filter.memory_id);
    }
    if (filter.namespace) {
      results = results.filter((r) => r.namespace === filter.namespace);
    }
    if (filter.memory_type) {
      results = results.filter((r) => r.memory_type === filter.memory_type);
    }
    if (filter.agent_id) {
      results = results.filter((r) => r.agent_id === filter.agent_id);
    }
    if (filter.status) {
      results = results.filter((r) => r.status === filter.status);
    }
    if (filter.text) {
      const lower = filter.text.toLowerCase();
      results = results.filter(
        (r) => r.content.value.toLowerCase().includes(lower)
      );
    }
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  async delete(memoryId: string): Promise<boolean> {
    await this.load();
    const before = this.data.records.length;
    this.data.records = this.data.records.filter(
      (r) => r.memory_id !== memoryId
    );
    if (this.data.records.length < before) {
      await this.save();
      return true;
    }
    return false;
  }

  async list(namespace?: string): Promise<AmhRecord[]> {
    await this.load();
    if (namespace) {
      return this.data.records.filter((r) => r.namespace === namespace);
    }
    return [...this.data.records];
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.load();
    this.data.audit.push(event);
    await this.save();
  }

  async getAudit(memoryId: string): Promise<AuditEvent[]> {
    await this.load();
    return this.data.audit.filter((e) => e.memory_id === memoryId);
  }

  async count(): Promise<number> {
    await this.load();
    return this.data.records.length;
  }

  async namespaces(): Promise<string[]> {
    await this.load();
    return [...new Set(this.data.records.map((r) => r.namespace))];
  }
}
