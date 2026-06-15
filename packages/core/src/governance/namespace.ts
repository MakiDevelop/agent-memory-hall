import type { AmhQuery } from "../schema/types.js";

export class NamespaceViolationError extends Error {
  constructor(agentNs: string, targetNs: string) {
    super(
      `Namespace isolation: agent in namespace "${agentNs}" cannot access "${targetNs}" without explicit cross-namespace permission`
    );
    this.name = "NamespaceViolationError";
  }
}

export function enforceNamespaceIsolation(
  agentNamespace: string | undefined,
  query: AmhQuery,
  allowCrossNamespace = false
): void {
  if (allowCrossNamespace || !agentNamespace) return;
  if (query.namespace && query.namespace !== agentNamespace) {
    throw new NamespaceViolationError(agentNamespace, query.namespace);
  }
}
