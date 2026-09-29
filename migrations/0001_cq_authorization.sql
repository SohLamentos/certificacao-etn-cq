-- Migration 0001: CQ Authorization and Governance Model
-- Target: Cloudflare D1 (etn-certificacao-cq-db-prod / 8da94645-7e04-42d0-9105-150246b98b2a)
-- Architecture: Decoupled local authorization linked to canonical ETN identity (etn_user_id).
-- Security Rule: NEVER store passwords, hashes, central tokens, or duplicate session records.

-- 1. Tabela de Habilitação de Acesso ao Aplicativo
-- Vincula o usuário canônico do ETN Materiais ao Certificação CQ
CREATE TABLE IF NOT EXISTS cq_app_access (
  id TEXT PRIMARY KEY,
  etn_user_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cq_app_access_enabled ON cq_app_access (enabled);

-- 2. Tabela de Papéis Locais (Suporta Múltiplas Roles por Identidade)
-- Apenas os perfis operacionais do CQ são admitidos nesta fase
CREATE TABLE IF NOT EXISTS cq_app_roles (
  id TEXT PRIMARY KEY,
  access_id TEXT NOT NULL REFERENCES cq_app_access(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'GESTOR', 'ANALISTA', 'CQ')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (access_id, role)
);

CREATE INDEX IF NOT EXISTS idx_cq_app_roles_role ON cq_app_roles (role);

-- 3. Tabela de Escopo Territorial Relacional (Restrito a UFs Oficiais)
-- Valida formato exato de 2 letras maiúsculas sem congelar entidades prematuras de polo
CREATE TABLE IF NOT EXISTS cq_app_scopes (
  id TEXT PRIMARY KEY,
  access_id TEXT NOT NULL REFERENCES cq_app_access(id) ON DELETE CASCADE,
  uf TEXT NOT NULL CHECK (LENGTH(uf) = 2 AND uf GLOB '[A-Z][A-Z]'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (access_id, uf)
);

CREATE INDEX IF NOT EXISTS idx_cq_app_scopes_uf ON cq_app_scopes (uf);

-- 4. Trilha de Auditoria Forense do Certificação CQ
-- Registra concessões, revogações e alterações de perfil sem armazenar dados sensíveis.
-- Independente de chave estrangeira: logs são PRESERVADOS mesmo após exclusão de acesso.
CREATE TABLE IF NOT EXISTS cq_audit_logs (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL CHECK (event IN (
    'ACCESS_GRANTED',
    'ACCESS_REVOKED',
    'ACCESS_STATUS_CHANGED',
    'ROLE_ADDED',
    'ROLE_REMOVED',
    'SCOPE_ADDED',
    'SCOPE_REMOVED'
  )),
  actor_etn_user_id TEXT,
  target_etn_user_id TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cq_audit_logs_target ON cq_audit_logs (target_etn_user_id);
CREATE INDEX IF NOT EXISTS idx_cq_audit_logs_event ON cq_audit_logs (event);
CREATE INDEX IF NOT EXISTS idx_cq_audit_logs_created_at ON cq_audit_logs (created_at DESC);
