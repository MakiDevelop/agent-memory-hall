import type { GovernanceRule } from "./types.js";

export interface GovernancePlaneStore {
  migrate(): void;
  putRule(rule: GovernanceRule): Promise<void>;
  getRule(ruleId: string): Promise<GovernanceRule | null>;
  getAllActiveRules(): Promise<GovernanceRule[]>;
  patchRuleStatus(ruleId: string, status: GovernanceRule["status"]): Promise<void>;
  cleanup(): Promise<void>;
}
