export type CQRole = 'ADMIN' | 'GESTOR' | 'ANALISTA' | 'CQ';

// UserRole mapped to CQRole for full system compatibility
export type UserRole = CQRole;

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface User {
  id: string;
  login: string;
  name: string;
  password_hash?: string; // Legacy field — DEACTIVATED from active architecture
  role: UserRole;
  status: UserStatus;
  must_change_password: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CQAppAccessRecord {
  id: string;
  etn_user_id: string; // Canonical user_id from ETN Materiais (UUID)
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CQAppRoleRecord {
  id: string;
  access_id: string;
  role: CQRole;
  ufs?: string[]; // Scoped Brazilian states when applicable
  created_at: string;
}

export interface SafeUser {
  id: string; // Canonical etn_user_id
  etn_user_id: string;
  login: string;
  name: string;
  email?: string;
  role: CQRole; // Primary role for legacy UI compatibility
  roles: CQRole[]; // Multi-role support
  ufs?: string[];
  etn_role?: string; // Role from central ETN Materiais
  status?: UserStatus;
  must_change_password: boolean;
  last_login_at?: string | null;
}

export interface Session {
  id: string; // Token digest (SHA-256)
  user_id: string; // Canonical etn_user_id
  created_at: string;
  expires_at: string;
  ip?: string;
  user_agent?: string;
  etn_token?: string; // Central token from ETN Materiais
  login?: string;
  name?: string;
}

export type AuditEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'ACCOUNT_LOCKED'
  | 'ACCESS_DENIED'
  | 'USER_BOOTSTRAPPED'
  | 'USER_CREATED'
  | 'USER_DISABLED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'ROLE_CHANGED'
  | 'CQ_ACCESS_GRANTED'
  | 'CQ_ACCESS_REVOKED';

export interface AuditLogEntry {
  id: string;
  event: AuditEventType;
  user_id: string | null;
  login_attempted?: string;
  ip?: string;
  user_agent?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
