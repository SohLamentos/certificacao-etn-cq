# ETN CERTIFICAÇÃO CQ — D1 GATE 1
## PREPARAÇÃO DAS MIGRATIONS D1 (VERSIONAMENTO E INTEGRIDADE)

**Data de Elaboração:** 29 de Setembro de 2026  
**Status do Gate:** MIGRATIONS PREPARADAS E TESTADAS LOCALMENTE (10/10 PASS)  
**Banco de Dados Target (Produção):**  
- **Nome:** `etn-certificacao-cq-db-prod`  
- **Database ID:** `8da94645-7e04-42d0-9105-150246b98b2a`  
- **Estado de Produção:** **0 tabelas, 0 queries, NENHUMA MIGRATION EXECUTADA**.  

---

### A. MIGRATION CRIADA

Foi criado o primeiro arquivo de migration canônico versionado para o Cloudflare D1:  
📁 **`migrations/0001_cq_authorization.sql`**

Este arquivo define com precisão atômica a estrutura relacional de governança e autorização do Certificação CQ desacoplada da autoridade central de senhas, em conformidade com as regras do SQLite/D1.

---

### B. SCHEMA

O schema da migration `0001_cq_authorization.sql` é composto por 4 tabelas relacionais especializadas:

```sql
-- 1. Habilitação de Acesso ao Aplicativo
CREATE TABLE IF NOT EXISTS cq_app_access (
  id TEXT PRIMARY KEY,
  etn_user_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Papéis Locais de Autorização (Múltiplas Roles por Identidade)
CREATE TABLE IF NOT EXISTS cq_app_roles (
  id TEXT PRIMARY KEY,
  access_id TEXT NOT NULL REFERENCES cq_app_access(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'GESTOR', 'ANALISTA', 'CQ')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (access_id, role)
);

-- 3. Escopo Territorial Relacional (Território / UFs / Polos)
CREATE TABLE IF NOT EXISTS cq_app_scopes (
  id TEXT PRIMARY KEY,
  access_id TEXT NOT NULL REFERENCES cq_app_access(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'UF' CHECK (scope_type IN ('UF', 'BASE', 'PARTNER')),
  scope_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (access_id, scope_type, scope_value)
);

-- 4. Trilha de Auditoria Forense
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
```

---

### C. CONSTRAINTS E REGRAS DE INTEGRIDADE

1. **Ausência de Foreign Key para Banco Externo:**
   - O campo `etn_user_id` referencia logicamente o UUID canônico do usuário registrado no D1 do ETN Materiais.
   - Como os bancos residem em D1s distintos, **não há FK física cross-database**. A integridade é garantida pela constraint local `TEXT NOT NULL UNIQUE` e validação via `MAT_API`.
2. **Restrição Estrita de Perfis (`CHECK (role IN ...)`):**
   - São admitidos exclusivamente: `'ADMIN'`, `'GESTOR'`, `'ANALISTA'`, `'CQ'`.
   - Perfis centrais como `MULTIPLICADOR` e `TECNICO` são rejeitados a nível de banco de dados se tentarem ser inseridos como roles do CQ.
3. **Múltiplas Roles sem Duplicação (`UNIQUE (access_id, role)`):**
   - Permite que uma mesma identidade física acumule, por exemplo, `ANALISTA` e `CQ`.
   - Impede que a mesma role seja atribuída duas vezes para o mesmo colaborador.
4. **Remoção em Cascata (`ON DELETE CASCADE`):**
   - Caso um registro de acesso seja removido de `cq_app_access`, todas as suas roles (`cq_app_roles`) e escopos territoriais (`cq_app_scopes`) associados são excluídos atomicamente.
5. **Flag Booleana Canônica (`enabled IN (0, 1)`):**
   - No SQLite/D1, valores booleanos são representados como inteiros binários (`1` = habilitado, `0` = suspenso/bloqueado). A constraint `CHECK` impede qualquer outro valor numérico ou textual.

---

### D. ÍNDICES DE PERFORMANCE

Índices criados estrategicamente para garantir consultas com tempo de resposta submilisegundo na borda:

- `idx_cq_app_access_etn_user_id`: Índice único para consulta instantânea no login por `etn_user_id`.
- `idx_cq_app_access_enabled`: Filtragem rápida de colaboradores habilitados.
- `idx_cq_app_roles_access_id`: Junção rápida entre `cq_app_access` e suas roles.
- `idx_cq_app_roles_role`: Indexação por papel para listagens administrativas.
- `idx_cq_app_scopes_access_id`: Consulta de restrições territoriais do usuário.
- `idx_cq_app_scopes_value`: Busca por UF (`scope_type = 'UF' AND scope_value = 'SP'`).
- `idx_cq_audit_logs_target` e `idx_cq_audit_logs_created_at`: Rastreabilidade cronológica e por usuário auditado.

---

### E. TERRITÓRIO (DECISÃO DE MODELAGEM)

- **Decisão:** Criada a tabela relacional **`cq_app_scopes`**, descartando expressamente qualquer serialização de arrays ou JSONs em colunas textuais (anti-pattern de strings separadas por vírgula).
- **Vantagens Comprovadas:**
  - Suporta unicidade via constraint composta `UNIQUE (access_id, scope_type, scope_value)`.
  - Suporta consultas indexadas diretas (ex: encontrar todos os avaliadores CQ autorizados na UF 'RJ').
  - Expansível futuramente para outros tipos de escopo (`BASE`, `PARTNER`) sem alterar o schema.

---

### F. AUDITORIA

- A tabela **`cq_audit_logs`** foi incluída nesta primeira migration para garantir governança operacional desde o primeiro provisionamento de usuários.
- **Blindagem de Segurança:**
  - `metadata`: Campo textual em formato JSON estritamente sanitizado.
  - **NUNCA armazena senhas, hashes, tokens JWT, Bearer tokens ou dados confidenciais (PII)**.
  - Armazena apenas o registro do evento (ex: `ACCESS_GRANTED`), ator responsável, alvo e perfil atribuído.

---

### G. WRANGLER CONFIG PREPARADA

Arquivo criado na raiz do projeto:  
📁 **`wrangler.toml`**

```toml
# Configuration for Cloudflare Worker: etn-certificacao-cq-api
# Pre-Gate 1: Prepared for future deployment (DO NOT DEPLOY YET)

name = "etn-certificacao-cq-api"
main = "server.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"
API_VERSION = "v1"

# Banco D1 de Produção do Certificação CQ (Criado manualmente na Cloudflare)
[[d1_databases]]
binding = "DB"
database_name = "etn-certificacao-cq-db-prod"
database_id = "8da94645-7e04-42d0-9105-150246b98b2a"
migrations_dir = "migrations"

# Service Binding nativo para a autoridade central de identidade (ETN Materiais)
# Mesma topologia comprovada na auditoria do ETN Simuladores
[[services]]
binding = "MAT_API"
service = "etn-materiais-api"
```

---

### H. TESTES LOCAIS (SUÍTE AUTOMATIZADA)

Arquivo de testes criado:  
📁 **`test/d1-migrations.test.ts`**

A suíte foi executada contra a engine SQLite local oficial (`node:sqlite`) com `PRAGMA foreign_keys = ON;`, validando com sucesso 100% dos cenários:

```
TAP version 13
# Subtest: D1 Migration 0001: Validação Estrutural e Regras de Integridade (SQLite Local)
    ok 1 - Script de migration executa com sucesso e é idempotente (IF NOT EXISTS)
    ok 2 - etn_user_id deve ser ÚNICO em cq_app_access
    ok 3 - Roles permitidas (ADMIN, GESTOR, ANALISTA, CQ) são aceitas com sucesso
    ok 4 - Roles inválidas (ex: MULTIPLICADOR, TECNICO, QUALQUER) são rejeitadas pelo CHECK
    ok 5 - Múltiplas roles para a mesma identidade são permitidas (ex: ANALISTA + CQ)
    ok 6 - Role duplicada para a mesma identidade é rejeitada (UNIQUE access_id, role)
    ok 7 - Remoção de cq_app_access remove roles e escopos em cascata (ON DELETE CASCADE)
    ok 8 - Flag enabled=0 e enabled=1 com CHECK constraint restritiva
    ok 9 - Escopo territorial relacional (cq_app_scopes) funciona e previne duplicidade
    ok 10 - cq_audit_logs registra eventos de governança sem dados sensíveis
1..10
# tests 10 / pass 10 / fail 0 (duration: 22ms)
```

Suíte global do projeto (`npm test`): **26 testes executados, 26 aprovados (100% PASS)**.

---

### I. PRÓXIMO GATE

Aguardar autorização formal para o próximo gate (execução das migrations no banco D1 de produção via comando controlado `wrangler d1 migrations apply etn-certificacao-cq-db-prod --remote` ou esteira CI/CD autorizada).

---

### CONFIRMAÇÕES FINAIS OBRIGATÓRIAS

- **D1 PRODUÇÃO ALTERADO:** **NÃO**
- **MIGRATION PRODUÇÃO EXECUTADA:** **NÃO**
- **MATERIAIS ALTERADO:** **NÃO**
- **SIMULADORES ALTERADO:** **NÃO**
- **DEPLOY REALIZADO:** **NÃO**

---

**STOP.**  
Preparação das migrations D1 concluída com sucesso. Nenhuma operação de rede, deploy ou gravação foi realizada na Cloudflare.
