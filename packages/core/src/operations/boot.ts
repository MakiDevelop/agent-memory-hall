import { existsSync } from "node:fs";
import type { AmhStore } from "../store/interface.js";
import type { AmhRecord } from "../schema/types.js";
import { latestMemories, isStateLike } from "./latest.js";
import type { ReadContext } from "./read.js";
import { MemhallStore } from "../store/memhall.js";

export interface BootOptions {
  namespace: string;
  limit?: number;
  agent_id?: string;
}

export interface BootArtifact {
  path: string;
  exists: boolean;
}

export interface BootResult {
  mode: "boot";
  namespace: string;
  generated_at: string;
  latest: AmhRecord[];
  primary: AmhRecord | null;
  open_blockers: string[];
  artifacts: BootArtifact[];
  store: {
    type: string;
    reachable: boolean | null;
  };
  next_actions: string[];
  protocol: {
    open_with: string;
    close_with: string;
    forbid: string;
  };
}

function extractArtifactPaths(content: string): string[] {
  const paths: string[] = [];
  const re =
    /artifact(?:_path)?:\s*(`?)([/~,A-Za-z]:[^\s`\n]+|\/[^\s`\n]+|~\/[^\s`\n]+)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const p = m[2]!.trim();
    if (p && p !== "⏭️" && !p.startsWith("⏭️")) {
      paths.push(p.replace(/^none$/i, "").trim());
    }
  }
  return paths.filter(Boolean);
}

function extractBlockers(content: string): string[] {
  const blockers: string[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*blocker:\s*(.+)\s*$/i);
    if (!m) continue;
    const v = m[1]!.trim();
    if (!v || /^無$|^none$|^n\/a$|^-$/i.test(v)) continue;
    blockers.push(v);
  }
  return blockers;
}

/**
 * Session compiler — single open entry for agents.
 * Loads chronological latest state; does NOT use relevance search.
 */
export async function bootSession(
  options: BootOptions,
  store: AmhStore,
  context: ReadContext = {},
  storeTypeHint = "unknown"
): Promise<BootResult> {
  const limit = options.limit ?? 5;
  const latest = await latestMemories(
    {
      namespace: options.namespace,
      agent_id: options.agent_id,
      limit,
      preferStateMarkers: true,
    },
    store,
    context
  );

  const primary = latest[0] ?? null;
  const open_blockers: string[] = [];
  const artifactPaths = new Set<string>();

  for (const r of latest) {
    open_blockers.push(...extractBlockers(r.content.value));
    for (const p of extractArtifactPaths(r.content.value)) {
      artifactPaths.add(p);
    }
  }

  const artifacts: BootArtifact[] = [...artifactPaths].map((path) => ({
    path,
    exists: existsSync(path.replace(/^~/, process.env.HOME ?? "")),
  }));

  let reachable: boolean | null = null;
  if (store instanceof MemhallStore) {
    const h = await store.healthCheck();
    reachable = h.ok;
  }

  const next_actions: string[] = [];
  if (primary && isStateLike(primary.content.value)) {
    const nextLine = primary.content.value
      .split("\n")
      .find((l) => /^\s*next:/i.test(l));
    if (nextLine) {
      next_actions.push(nextLine.replace(/^\s*next:\s*/i, "").trim());
    }
  }
  if (artifacts.some((a) => a.exists)) {
    next_actions.push(
      `Read handoff: ${artifacts.find((a) => a.exists)!.path}`
    );
  }
  if (artifacts.some((a) => !a.exists && a.path.includes("/"))) {
    next_actions.push("WARN: some artifact paths missing on disk");
  }
  if (!primary) {
    next_actions.push("No prior state — treat as greenfield; ask human for goal");
  }

  return {
    mode: "boot",
    namespace: options.namespace,
    generated_at: new Date().toISOString(),
    latest,
    primary,
    open_blockers: [...new Set(open_blockers)],
    artifacts,
    store: { type: storeTypeHint, reachable },
    next_actions,
    protocol: {
      open_with: "amh boot --ns <ns>  (or amh latest)",
      close_with:
        "amh write --kind state --status-label open|blocked|done --artifact <path|⏭️ none>",
      forbid: "do not use relevance search as session handoff",
    },
  };
}
