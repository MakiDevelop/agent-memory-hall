export type {
  AuthorizationDecision,
  Credential,
  CredentialData,
  CredentialStatus,
  CredentialType,
  Grant,
  GrantPermission,
  GrantStatus,
  Principal,
  PrincipalStatus,
  PrincipalType,
} from "./types.js";
export type { IdentityStore } from "./store.js";
export { SqliteIdentityStore } from "./sqlite-identity-store.js";
export {
  AuthenticationError,
  IdentityError,
  authenticate,
  authorize,
  grantPermission,
  registerPrincipal,
  revokeGrant,
  suspendPrincipal,
} from "./operations.js";
