import { randomUUID } from "node:crypto";
import type { GovernancePlaneStore } from "./store.js";
import type { GovernanceRule, RuleCategory } from "./types.js";
import type { RiskLevel } from "../decision/types.js";

export class GovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GovernanceError";
  }
}

const AMENDMENT_RISK: Record<RuleCategory, RiskLevel> = {
  immutable: "critical",
  structural: "critical",
  operational: "high",
};

export async function defineRule(
  rule: Omit<GovernanceRule, "version" | "status">,
  store: GovernancePlaneStore,
): Promise<{ rule_id: string; version: number; status: "active" }> {
  if (!rule.rule_id.trim()) throw new GovernanceError("rule_id is required");
  if (await store.getRule(rule.rule_id)) {
    throw new GovernanceError(`Rule already exists: ${rule.rule_id}`);
  }

  await store.putRule({ ...rule, version: 1, status: "active" });
  return { rule_id: rule.rule_id, version: 1, status: "active" };
}

export async function proposeAmendment(
  targetRuleId: string,
  proposedSpec: string,
  rationale: string,
  _proposerPrincipalId: string,
  store: GovernancePlaneStore,
): Promise<{ amendment_id: string; decision_id: string; risk_level: RiskLevel }> {
  const rule = await store.getRule(targetRuleId);
  if (!rule) throw new GovernanceError(`Rule not found: ${targetRuleId}`);

  if (rule.category === "immutable") {
    throw new GovernanceError("Cannot amend immutable rules");
  }

  const riskLevel = AMENDMENT_RISK[rule.category];
  const amendmentId = randomUUID();
  const decisionId = randomUUID();

  return { amendment_id: amendmentId, decision_id: decisionId, risk_level: riskLevel };
}

export async function suspendRule(
  ruleId: string,
  reason: string,
  store: GovernancePlaneStore,
): Promise<{ rule_id: string; status: "suspended" }> {
  if (!reason.trim()) throw new GovernanceError("reason is required");
  const rule = await store.getRule(ruleId);
  if (!rule) throw new GovernanceError(`Rule not found: ${ruleId}`);

  if (rule.category === "immutable") {
    throw new GovernanceError("Cannot suspend immutable rules");
  }

  await store.patchRuleStatus(ruleId, "suspended");
  return { rule_id: ruleId, status: "suspended" };
}

export async function healthCheck(
  timeWindowDays: number,
  governanceStore: GovernancePlaneStore,
  getActiveRoleIds?: () => Promise<string[]>,
  getExercisedRoleIds?: (since: string) => Promise<string[]>,
): Promise<{ dormant_rules: string[]; unexercised_roles: string[] }> {
  const rules = await governanceStore.getAllActiveRules();

  // Dormant rules: active rules that haven't been referenced/invoked
  // For now, all active rules are considered "exercised" — dormancy detection
  // requires audit trail integration (future enhancement)
  const dormant_rules: string[] = [];

  // Unexercised roles: roles that exist but haven't been used in the time window
  let unexercised_roles: string[] = [];
  if (getActiveRoleIds && getExercisedRoleIds) {
    const since = new Date(Date.now() - timeWindowDays * 86400000).toISOString();
    const allRoles = await getActiveRoleIds();
    const exercised = new Set(await getExercisedRoleIds(since));
    unexercised_roles = allRoles.filter(id => !exercised.has(id));
  }

  return { dormant_rules, unexercised_roles };
}
