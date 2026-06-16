import type { Decision, DecisionStatus, RatificationRecord } from "./types.js";
import type { IndependentReviewRecord } from "../authority/types.js";

export interface DecisionStore {
  migrate(): void;

  putDecision(decision: Decision): Promise<void>;
  getDecision(decisionId: string): Promise<Decision | null>;

  patchDecisionStatus(
    decisionId: string,
    status: DecisionStatus,
    extra?: {
      ratification?: RatificationRecord;
      effective_at?: string;
      review_deadline?: string;
    },
  ): Promise<void>;

  cleanup(): Promise<void>;
}
