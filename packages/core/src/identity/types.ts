export type PrincipalType = "human" | "agent" | "system";
export type PrincipalStatus = "active" | "suspended" | "revoked";
export type GrantPermission = "read" | "write" | "transfer" | "admin";
export type GrantStatus = "active" | "revoked";
export type CredentialType = "bearer_token" | "api_key" | "mtls_cert" | "did_assertion" | "custom";
export type CredentialStatus = "active" | "revoked";

export interface Principal {
  principal_id: string;
  principal_type: PrincipalType;
  display_name?: string;
  status: PrincipalStatus;
  created_at: string;
}

export interface Credential {
  credential_id: string;
  principal_id: string;
  credential_type: CredentialType;
  issued_at: string;
  expires_at?: string | null;
  status: CredentialStatus;
}

export interface CredentialData {
  principal_id?: string;
  token?: string;
}

export interface Grant {
  grant_id: string;
  granter_principal_id: string;
  grantee_principal_id: string;
  namespace_id: string;
  permissions: GrantPermission[];
  granted_at: string;
  expires_at?: string | null;
  status: GrantStatus;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
}
