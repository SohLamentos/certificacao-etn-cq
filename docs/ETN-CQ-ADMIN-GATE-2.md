# ETN CERTIFICAÇÃO CQ — ADMIN GATE 2
## CONCESSÃO CONTROLADA DO PRIMEIRO ADMIN LOCAL CQ

**Data de Elaboração:** 2026-09-30  
**Ambiente:** Cloudflare D1 / Certificação CQ  
**Banco Alvo:** `etn-certificacao-cq-db-prod`  
**Database ID:** `8da94645-7e04-42d0-9105-150246b98b2a`  
**Status do Gate:** PREPARADO COM ATOMICIDADE RIGOROSA / AGUARDANDO EXECUÇÃO D1 VIA CLI/DASHBOARD  

---

### 1. Identidade Central Homologada
- **Login:** `admin`
- **ETN User ID (canônico):** `651ad006-8c7e-4c11-9b6a-832320c902eb`
- **Nome:** Administrador do Sistema
- **Role Central ETN:** `ADMIN`
- **Status Central:** `ACTIVE`
- **Autenticação Central:** `PASS` (Confirmada no POST `/api/auth/login`)

---

### 2. Regras de Isolamento e Segurança
1. **Banco Alvo Único:** Exclusivamente `etn-certificacao-cq-db-prod` (`8da94645-7e04-42d0-9105-150246b98b2a`).
2. **Proibição de Escrita:** Proibido tocar em `etn-materiais-db-prod`, `etn-simuladores-db-prod` ou qualquer outro D1.
3. **Não-criação de Usuário:** O Certificação CQ não possui tabela de usuários locais nem campos de senha. Apenas referencia `etn_user_id`.
4. **Sem Scopes Territoriais:** O primeiro ADMIN possui escopo `GLOBAL`, portanto 0 registros em `cq_app_scopes`.
5. **Auditoria Sanitizada:** Registros em `cq_audit_logs` com eventos oficiais da migration 0001 (`ACCESS_GRANTED`, `ROLE_ADDED`), sem qualquer token, senha ou dado sensível.

---

### 3. Script SQL Atômico Unificado (Concessão + Auditoria)

```sql
-- D1: etn-certificacao-cq-db-prod (8da94645-7e04-42d0-9105-150246b98b2a)
-- EXECUÇÃO ATÔMICA DA CONCESSÃO DO PRIMEIRO ADMIN LOCAL

-- 1. Preflight Read-Only
SELECT 'PREFLIGHT_ACCESS' AS check_type, count(*) AS count FROM cq_app_access WHERE etn_user_id = '651ad006-8c7e-4c11-9b6a-832320c902eb';

-- 2. Concessão Atômica de Acesso
INSERT INTO cq_app_access (id, etn_user_id, enabled, created_at, updated_at)
VALUES (
  'a001-cq-admin-651ad006',
  '651ad006-8c7e-4c11-9b6a-832320c902eb',
  1,
  datetime('now'),
  datetime('now')
);

-- 3. Concessão de Role ADMIN Local
INSERT INTO cq_app_roles (id, access_id, role, created_at)
VALUES (
  'r001-cq-admin-651ad006',
  'a001-cq-admin-651ad006',
  'ADMIN',
  datetime('now')
);

-- 4. Registro de Auditoria Sanitizado (Schema Oficial 0001)
INSERT INTO cq_audit_logs (id, event, actor_etn_user_id, target_etn_user_id, metadata, created_at)
VALUES (
  'log-001-cq-admin-651ad006-access',
  'ACCESS_GRANTED',
  '651ad006-8c7e-4c11-9b6a-832320c902eb',
  '651ad006-8c7e-4c11-9b6a-832320c902eb',
  '{"reason":"BOOTSTRAP_FIRST_ADMIN","login":"admin"}',
  datetime('now')
);

INSERT INTO cq_audit_logs (id, event, actor_etn_user_id, target_etn_user_id, metadata, created_at)
VALUES (
  'log-002-cq-admin-651ad006-role',
  'ROLE_ADDED',
  '651ad006-8c7e-4c11-9b6a-832320c902eb',
  '651ad006-8c7e-4c11-9b6a-832320c902eb',
  '{"role":"ADMIN","scope":"GLOBAL"}',
  datetime('now')
);

-- 5. Reconciliação Imediata
SELECT id, etn_user_id, enabled, created_at FROM cq_app_access WHERE etn_user_id = '651ad006-8c7e-4c11-9b6a-832320c902eb';
SELECT id, access_id, role, created_at FROM cq_app_roles WHERE access_id = 'a001-cq-admin-651ad006';
SELECT count(*) AS total_scopes FROM cq_app_scopes WHERE access_id = 'a001-cq-admin-651ad006';
SELECT id, event, actor_etn_user_id, target_etn_user_id, metadata FROM cq_audit_logs WHERE target_etn_user_id = '651ad006-8c7e-4c11-9b6a-832320c902eb';
```

---

### 4. Instruções de Execução no Ambiente Cloudflare
Como o container de desenvolvimento opera sem o `CLOUDFLARE_API_TOKEN` no ambiente não-interativo, a execução deve ser disparada pelo operador com credenciais Cloudflare:

```bash
# Via Cloudflare Wrangler CLI autenticado:
wrangler d1 execute etn-certificacao-cq-db-prod --remote --file=./scripts/admin_bootstrap_grant.sql

# Ou via Cloudflare Dashboard:
# Workers & Pages -> D1 SQL Databases -> etn-certificacao-cq-db-prod -> Console
```
