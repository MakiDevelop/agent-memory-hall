import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const GovernanceSchema = z.object({
  dedup: z.boolean().optional(),
  anti_ouroboros: z.boolean().optional(),
  namespace_isolation: z.boolean().optional(),
  write_gate: z.boolean().optional(),
});

const ConfigSchema = z.object({
  store: z.enum(["json", "sqlite", "postgres", "memhall"]).optional(),
  store_path: z.string().optional(),
  memhall_token: z.string().optional(),
  caller_namespace: z.string().optional(),
  governance: GovernanceSchema.optional(),
});

export type AmhConfig = z.infer<typeof ConfigSchema>;

export interface ResolvedGovernance {
  dedup: boolean;
  antiOuroboros: boolean;
  namespaceIsolation: boolean;
  writeGate: boolean;
}

const DEFAULT_GOVERNANCE: ResolvedGovernance = {
  dedup: true,
  antiOuroboros: true,
  namespaceIsolation: true,
  writeGate: true,
};

export function resolveGovernance(config?: AmhConfig): ResolvedGovernance {
  const g = config?.governance;
  return {
    dedup: g?.dedup ?? DEFAULT_GOVERNANCE.dedup,
    antiOuroboros: g?.anti_ouroboros ?? DEFAULT_GOVERNANCE.antiOuroboros,
    namespaceIsolation: g?.namespace_isolation ?? DEFAULT_GOVERNANCE.namespaceIsolation,
    writeGate: g?.write_gate ?? DEFAULT_GOVERNANCE.writeGate,
  };
}

export function defaultConfigPath(): string {
  return join(homedir(), ".amh", "config.json");
}

export async function loadConfig(path?: string): Promise<AmhConfig> {
  const configPath = path ?? defaultConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = await readFile(configPath, "utf-8");
    return ConfigSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}