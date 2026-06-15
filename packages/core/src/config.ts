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

const IdentityConfigSchema = z.object({
  enabled: z.boolean().optional(),
  enforce_human_tier: z.boolean().optional(),
});

const ConfigSchema = z.object({
  store: z.enum(["json", "sqlite", "postgres", "memhall"]).optional(),
  store_path: z.string().optional(),
  memhall_token: z.string().optional(),
  caller_namespace: z.string().optional(),
  governance: GovernanceSchema.optional(),
  identity: IdentityConfigSchema.optional(),
});

export type AmhConfig = z.infer<typeof ConfigSchema>;

export interface ResolvedGovernance {
  dedup: boolean;
  antiOuroboros: boolean;
  namespaceIsolation: boolean;
  writeGate: boolean;
}

export interface ResolvedIdentityConfig {
  enabled: boolean;
  enforceHumanTier: boolean;
}

const DEFAULT_GOVERNANCE: ResolvedGovernance = {
  dedup: true,
  antiOuroboros: true,
  namespaceIsolation: true,
  writeGate: true,
};

const DEFAULT_IDENTITY: ResolvedIdentityConfig = {
  enabled: false,
  enforceHumanTier: true,
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

export function resolveIdentityConfig(config?: AmhConfig): ResolvedIdentityConfig {
  const identity = config?.identity;
  return {
    enabled: identity?.enabled ?? DEFAULT_IDENTITY.enabled,
    enforceHumanTier: identity?.enforce_human_tier ?? DEFAULT_IDENTITY.enforceHumanTier,
  };
}

export function defaultConfigPath(): string {
  return join(homedir(), ".amh", "config.json");
}

export class ConfigLoadError extends Error {
  constructor(
    public readonly configPath: string,
    cause: unknown
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to load AMH config from ${configPath}: ${detail}`);
    this.name = "ConfigLoadError";
  }
}

export async function loadConfig(path?: string): Promise<AmhConfig> {
  const configPath = path ?? defaultConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = await readFile(configPath, "utf-8");
    return ConfigSchema.parse(JSON.parse(raw));
  } catch (err) {
    throw new ConfigLoadError(configPath, err);
  }
}
