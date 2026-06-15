import type { Grant, Principal } from "./types.js";

export interface IdentityStore {
  putPrincipal(principal: Principal): Promise<void>;
  getPrincipal(principalId: string): Promise<Principal | null>;
  putGrant(grant: Grant): Promise<void>;
  getGrant(grantId: string): Promise<Grant | null>;
  getGrantsForPrincipal(principalId: string, namespaceId: string): Promise<Grant[]>;
  revokeGrant(grantId: string): Promise<void>;
}
