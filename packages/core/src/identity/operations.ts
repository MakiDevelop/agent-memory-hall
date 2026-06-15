import { randomUUID } from "node:crypto";
import type { IdentityStore } from "./store.js";
import type {
  AuthorizationDecision,
  CredentialData,
  Grant,
  GrantPermission,
  Principal,
  PrincipalType,
} from "./types.js";

export class IdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityError";
  }
}

export class AuthenticationError extends IdentityError {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function registerPrincipal(
  id: string,
  type: PrincipalType,
  displayName: string | undefined,
  store: IdentityStore,
): Promise<Principal> {
  if (!id.trim()) {
    throw new IdentityError("principal_id is required");
  }
  if (await store.getPrincipal(id)) {
    throw new IdentityError(`Principal already exists: ${id}`);
  }

  const principal: Principal = {
    principal_id: id,
    principal_type: type,
    display_name: displayName,
    status: "active",
    created_at: new Date().toISOString(),
  };
  await store.putPrincipal(principal);
  return principal;
}

export async function authenticate(credentialData: CredentialData, store: IdentityStore): Promise<Principal> {
  const principalId = credentialData.principal_id ?? credentialData.token;
  if (!principalId) {
    throw new AuthenticationError("Invalid credential: missing principal_id");
  }
  const principal = await store.getPrincipal(principalId);
  if (!principal) {
    throw new AuthenticationError("Invalid credential: principal not found");
  }
  if (principal.status !== "active") {
    throw new AuthenticationError(`Principal is not active: ${principal.status}`);
  }
  return principal;
}

export async function authorize(
  principalId: string,
  namespaceId: string,
  permission: GrantPermission,
  store: IdentityStore,
): Promise<AuthorizationDecision> {
  try {
    const principal = await store.getPrincipal(principalId);
    if (!principal) return { allowed: false, reason: "principal_not_found" };
    if (principal.status !== "active") return { allowed: false, reason: `principal_${principal.status}` };

    const grants = await store.getGrantsForPrincipal(principalId, namespaceId);
    const now = Date.now();
    const active = grants.filter((grant) => {
      if (grant.status !== "active") return false;
      return !grant.expires_at || Date.parse(grant.expires_at) > now;
    });

    const allowed = active.some((grant) => grant.permissions.includes(permission) || grant.permissions.includes("admin"));
    return allowed ? { allowed: true } : { allowed: false, reason: "permission_denied" };
  } catch (err) {
    return {
      allowed: false,
      reason: err instanceof Error ? err.message : "authorization_error",
    };
  }
}

export async function grantPermission(
  granter: string,
  grantee: string,
  ns: string,
  permissions: GrantPermission[],
  store: IdentityStore,
  expiresAt?: string | null,
): Promise<Grant> {
  if (permissions.length === 0) {
    throw new IdentityError("At least one permission is required");
  }
  const granterPrincipal = await store.getPrincipal(granter);
  if (!granterPrincipal || granterPrincipal.status !== "active") {
    throw new IdentityError("Granter principal must be active");
  }
  const granteePrincipal = await store.getPrincipal(grantee);
  if (!granteePrincipal || granteePrincipal.status !== "active") {
    throw new IdentityError("Grantee principal must be active");
  }

  const adminDecision = await authorize(granter, ns, "admin", store);
  const canBootstrap = granterPrincipal.principal_type === "human" || granterPrincipal.principal_type === "system";
  if (!adminDecision.allowed && !canBootstrap) {
    throw new IdentityError("Granter lacks admin permission");
  }

  const grant: Grant = {
    grant_id: randomUUID(),
    granter_principal_id: granter,
    grantee_principal_id: grantee,
    namespace_id: ns,
    permissions,
    granted_at: new Date().toISOString(),
    expires_at: expiresAt ?? undefined,
    status: "active",
  };
  await store.putGrant(grant);
  return grant;
}

export async function revokeGrant(
  grantId: string,
  revokedBy: string,
  store: IdentityStore,
): Promise<{ grant_id: string; status: "revoked" }> {
  const grant = await store.getGrant(grantId);
  if (!grant) {
    throw new IdentityError(`Grant not found: ${grantId}`);
  }
  const revoker = await store.getPrincipal(revokedBy);
  if (!revoker || revoker.status !== "active") {
    throw new IdentityError("Revoker principal must be active");
  }

  const adminDecision = await authorize(revokedBy, grant.namespace_id, "admin", store);
  const canBootstrap = revoker.principal_type === "human" || revoker.principal_type === "system";
  if (!adminDecision.allowed && !canBootstrap) {
    throw new IdentityError("Revoker lacks admin permission");
  }

  await store.revokeGrant(grantId);
  return { grant_id: grantId, status: "revoked" };
}

export async function suspendPrincipal(
  principalId: string,
  store: IdentityStore,
): Promise<Principal> {
  const principal = await store.getPrincipal(principalId);
  if (!principal) {
    throw new IdentityError(`Principal not found: ${principalId}`);
  }

  const updated: Principal = { ...principal, status: "suspended" };
  if ("updatePrincipalStatus" in store && typeof store.updatePrincipalStatus === "function") {
    await store.updatePrincipalStatus(principalId, "suspended");
  } else {
    await store.putPrincipal(updated);
  }
  return updated;
}
