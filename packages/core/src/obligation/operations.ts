import type { ObligationStore } from "./store.js";
import type {
  ActionType,
  AuditEntry,
  ObligationPacket,
  ObligationStatus,
  PolicyEvaluation,
} from "./types.js";

export interface ObligationActor {
  actor_id: string;
  source_tier: string;
}

export interface ObligationActionOptions {
  now?: Date;
  externalConditions?: Record<string, boolean>;
  evaluationTtlSeconds?: number;
}

export class ObligationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObligationError";
  }
}

export class ForbiddenClosureError extends ObligationError {
  constructor(message = "llm_derived actors cannot close obligations") {
    super(message);
    this.name = "ForbiddenClosureError";
  }
}

const STALE_RECOVERY_ACTIONS: ActionType[] = ["refresh_evidence", "query_owner", "escalate"];

export async function putObligation(
  packet: ObligationPacket,
  evaluation: PolicyEvaluation,
  store: ObligationStore,
): Promise<{ obligation_id: string; status: ObligationStatus }> {
  validateObligation(packet);
  validateEvaluation(evaluation);
  await store.putObligation(packet, evaluation);
  return { obligation_id: packet.obligation_id, status: packet.status };
}

export async function closeObligation(
  obligationId: string,
  actor: ObligationActor,
  store: ObligationStore,
): Promise<{ obligation_id: string; status: "closed" }> {
  const obligation = await requireObligation(obligationId, store);

  if (actor.source_tier === "llm_derived") {
    await audit(store, obligationId, "llm_derived_closure", `actor=${actor.actor_id}`);
    throw new ForbiddenClosureError();
  }

  if (obligation.missing_evidence.length > 0) {
    await audit(
      store,
      obligationId,
      "missing_evidence_closure",
      `missing_evidence=${JSON.stringify(obligation.missing_evidence)}`,
    );
    throw new ObligationError("Cannot close obligation with missing evidence");
  }

  await store.patchStatus(obligationId, "closed");
  return { obligation_id: obligationId, status: "closed" };
}

export async function performObligationAction(
  obligationId: string,
  action: ActionType,
  actor: ObligationActor,
  store: ObligationStore,
  opts: ObligationActionOptions = {},
): Promise<{ obligation_id: string; action: ActionType; allowed: true }> {
  const obligation = await requireObligation(obligationId, store);
  const evaluation = await store.getEvaluation(obligationId);

  await rejectBorrowedAuthority(obligationId, evaluation, store);
  await rejectSelfOrExpiredEvaluation(obligationId, actor, evaluation, store, opts);

  const effectiveObligation = await applyStaleInvalidation(obligation, store, opts);
  if (!effectiveObligation.allowed_next_actions.includes(action)) {
    throw new ObligationError(`Action not allowed for obligation: ${action}`);
  }

  if (!evaluation?.operation_permissions.includes(action)) {
    throw new ObligationError(`Evaluation does not grant permission: ${action}`);
  }

  return { obligation_id: obligationId, action, allowed: true };
}

export async function activateBreakGlass(
  obligationId: string,
  actor: ObligationActor,
  authority: { authority_id: string; principal_id: string },
  store: ObligationStore,
): Promise<{ obligation_id: string; status: "in_progress"; authority_id: string }> {
  await requireObligation(obligationId, store);
  if (authority.principal_id === actor.actor_id) {
    throw new ObligationError("Break-glass requires non-acting-agent authority");
  }

  await store.patchStatus(obligationId, "in_progress");
  await audit(store, obligationId, "break_glass_activation", `authority=${authority.authority_id};actor=${actor.actor_id}`);
  return { obligation_id: obligationId, status: "in_progress", authority_id: authority.authority_id };
}

async function rejectBorrowedAuthority(
  obligationId: string,
  evaluation: PolicyEvaluation | null,
  store: ObligationStore,
): Promise<void> {
  if (evaluation && evaluation.bound_obligation_id !== obligationId) {
    await audit(
      store,
      obligationId,
      "attempted_authority_reuse",
      `bound=${evaluation.bound_obligation_id};target=${obligationId}`,
    );
    throw new ObligationError("Policy evaluation is bound to a different obligation");
  }
}

async function rejectSelfOrExpiredEvaluation(
  obligationId: string,
  actor: ObligationActor,
  evaluation: PolicyEvaluation | null,
  store: ObligationStore,
  opts: ObligationActionOptions,
): Promise<void> {
  if (!evaluation) {
    await audit(store, obligationId, "self_evaluator_refusal", "missing evaluation");
    throw new ObligationError("Permission-bearing action requires policy evaluation");
  }

  if (evaluation.evaluator_id === actor.actor_id) {
    await audit(store, obligationId, "self_evaluator_refusal", `actor=${actor.actor_id}`);
    throw new ObligationError("Self-evaluator cannot perform permission-bearing actions");
  }

  if (isEvaluationExpired(evaluation, opts)) {
    await audit(store, obligationId, "stale_evaluation_reuse", `evaluated_at=${evaluation.evaluated_at}`);
    throw new ObligationError("Policy evaluation expired");
  }
}

async function applyStaleInvalidation(
  obligation: ObligationPacket,
  store: ObligationStore,
  opts: ObligationActionOptions,
): Promise<ObligationPacket> {
  if (!isObligationStale(obligation, opts)) {
    return obligation;
  }

  await store.patchAllowedActions(obligation.obligation_id, STALE_RECOVERY_ACTIONS);
  await store.patchStatus(obligation.obligation_id, "stale");
  return {
    ...obligation,
    status: "stale",
    allowed_next_actions: STALE_RECOVERY_ACTIONS,
  };
}

function isObligationStale(obligation: ObligationPacket, opts: ObligationActionOptions): boolean {
  if (obligation.stale_if.type === "ttl") {
    const touchedMs = Date.parse(obligation.last_touched_at);
    return !Number.isNaN(touchedMs) && nowMs(opts) - touchedMs >= obligation.stale_if.seconds * 1000;
  }

  return opts.externalConditions?.[obligation.stale_if.ref] === true;
}

function isEvaluationExpired(evaluation: PolicyEvaluation, opts: ObligationActionOptions): boolean {
  if (opts.evaluationTtlSeconds === undefined) {
    return false;
  }
  const evaluatedMs = Date.parse(evaluation.evaluated_at);
  return Number.isNaN(evaluatedMs) || nowMs(opts) - evaluatedMs >= opts.evaluationTtlSeconds * 1000;
}

function nowMs(opts: ObligationActionOptions): number {
  return opts.now?.getTime() ?? Date.now();
}

async function requireObligation(id: string, store: ObligationStore): Promise<ObligationPacket> {
  const obligation = await store.getObligation(id);
  if (!obligation) {
    throw new ObligationError(`Obligation not found: ${id}`);
  }
  return obligation;
}

async function audit(
  store: ObligationStore,
  obligationId: string,
  type: AuditEntry["type"],
  details: string,
): Promise<void> {
  await store.appendAudit(obligationId, {
    type,
    details,
    timestamp: new Date().toISOString(),
  });
}

function validateObligation(packet: ObligationPacket): void {
  if (!packet.obligation_id.trim()) throw new ObligationError("obligation_id is required");
  if (!packet.promise.trim()) throw new ObligationError("promise is required");
  if (!packet.owner.trim()) throw new ObligationError("owner is required");
  if (!packet.fallback_owner.trim()) throw new ObligationError("fallback_owner is required");
}

function validateEvaluation(evaluation: PolicyEvaluation): void {
  if (!evaluation.evaluator_id.trim()) throw new ObligationError("evaluator_id is required");
  if (!evaluation.bound_obligation_id.trim()) throw new ObligationError("bound_obligation_id is required");
  if (!evaluation.policy_version.trim()) throw new ObligationError("policy_version is required");
}
