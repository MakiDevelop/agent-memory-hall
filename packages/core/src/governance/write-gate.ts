import type { AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { checkSourceTier } from "./source-tier.js";
import { checkDedup, computeContentHash } from "./dedup.js";
import { NamespaceViolationError } from "./namespace.js";
import { requireTrustedCaller } from "./caller.js";

export interface WriteGateConfig {
  dedup: boolean;
  antiOuroboros: boolean;
  namespaceIsolation: boolean;
  writeGate: boolean;
  /** Content quality rules (default true when writeGate on). */
  contentQuality?: boolean;
}

const DEFAULT_CONFIG: WriteGateConfig = {
  dedup: true,
  antiOuroboros: true,
  namespaceIsolation: true,
  writeGate: true,
  contentQuality: true,
};

/** Soft-warn threshold for [state …] entries (chars). */
export const STATE_LENGTH_WARN = 800;

export class ContentQualityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentQualityError";
  }
}

export interface WriteGateContext {
  callerNamespace?: string;
}

export interface WriteGateResult {
  record: AmhRecord;
  governanceApplied: string[];
}

function detectKind(content: string): "state" | "pointer" | "memory" {
  const head = content.trimStart().slice(0, 120).toLowerCase();
  if (head.startsWith("[pointer") || /^kind:\s*pointer/m.test(content)) {
    return "pointer";
  }
  if (
    head.startsWith("[state ") ||
    head.startsWith("[state]") ||
    /^kind:\s*state/m.test(content)
  ) {
    return "state";
  }
  return "memory";
}

function hasArtifactPath(content: string): boolean {
  // Absolute path or explicit artifact: line
  if (/artifact:\s*(\/|~\/|[A-Za-z]:\\)/i.test(content)) return true;
  if (/artifact_path:\s*(\/|~\/)/i.test(content)) return true;
  // Markdown path-like token after "artifact"
  if (/artifact[:\s]+`?[/~][^\s`]+/i.test(content)) return true;
  return false;
}

export function checkContentQuality(content: string): string[] {
  const applied: string[] = [];
  const trimmed = content.trim();

  if (trimmed.length < 2) {
    throw new ContentQualityError("content too short (min 2 chars)");
  }
  if (/^(test|TODO|xxx|\.\.\.)$/i.test(trimmed)) {
    throw new ContentQualityError(
      `content rejected as placeholder: "${trimmed}" (write a real fact or use kind=memory with substance)`
    );
  }

  const kind = detectKind(content);
  applied.push(`kind_detect:${kind}`);

  if (kind === "pointer" && !hasArtifactPath(content)) {
    throw new ContentQualityError(
      "kind=pointer requires artifact path (e.g. artifact: /absolute/path/to/handoff)"
    );
  }

  if (kind === "state" && trimmed.length > STATE_LENGTH_WARN) {
    applied.push(`state_length_warn:${trimmed.length}>${STATE_LENGTH_WARN}`);
  }

  return applied;
}

export async function runWriteGate(
  record: AmhRecord,
  store: AmhStore,
  config: Partial<WriteGateConfig> = {},
  context: WriteGateContext = {}
): Promise<WriteGateResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const governanceApplied: string[] = [];

  if (!cfg.writeGate) {
    return { record, governanceApplied };
  }

  if (cfg.namespaceIsolation) {
    requireTrustedCaller(true, context.callerNamespace);
    if (record.namespace !== context.callerNamespace) {
      throw new NamespaceViolationError(context.callerNamespace!, record.namespace);
    }
    governanceApplied.push("namespace_isolation");
  }

  if (cfg.contentQuality !== false) {
    const quality = checkContentQuality(record.content.value);
    governanceApplied.push("content_quality", ...quality);
  }

  if (cfg.antiOuroboros) {
    await checkSourceTier(record, store, {
      callerNamespace: context.callerNamespace,
      namespaceIsolation: cfg.namespaceIsolation,
    });
    governanceApplied.push("anti_ouroboros");
  }

  record.content_hash = computeContentHash(record.content.format, record.content.value);
  governanceApplied.push("content_hash");

  if (cfg.dedup) {
    await checkDedup(record, store);
    governanceApplied.push("dedup");
  }

  return { record, governanceApplied };
}