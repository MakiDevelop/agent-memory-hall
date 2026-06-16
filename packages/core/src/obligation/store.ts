import type {
  ActionType,
  AuditEntry,
  ObligationPacket,
  ObligationStatus,
  PolicyEvaluation,
} from "./types.js";

export interface ObligationStore {
  migrate(): void;

  putObligation(packet: ObligationPacket, evaluation: PolicyEvaluation): Promise<void>;
  getObligation(id: string): Promise<ObligationPacket | null>;
  getEvaluation(id: string): Promise<PolicyEvaluation | null>;
  patchStatus(id: string, status: ObligationStatus): Promise<void>;
  patchAllowedActions(id: string, actions: ActionType[]): Promise<void>;
  appendAudit(obligationId: string, entry: AuditEntry): Promise<void>;
  cleanup(): Promise<void>;
}
