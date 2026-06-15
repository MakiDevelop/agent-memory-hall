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
  callerNamespace: string | undefined,
  query: AmhQuery,
  allowCrossNamespace = false
): AmhQuery {
  if (allowCrossNamespace || !callerNamespace) return query;
  if (query.namespace && query.namespace !== callerNamespace) {
    throw new NamespaceViolationError(callerNamespace, query.namespace);
  }
  if (!query.namespace) {
    return { ...query, namespace: callerNamespace };
  }
  return query;
}