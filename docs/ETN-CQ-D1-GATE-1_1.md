# ETN CERTIFICAÇÃO CQ — D1 GATE 1.1
## AUDITORIA FINAL DE ENGENHARIA DA MIGRATION 0001 ANTES DE PRODUÇÃO

**Data de Realização:** 29 de Setembro de 2026  
**Status do Gate:** APROVADO COM REFINAMENTOS APLICADOS (APPROVED)  
**Banco Target:** `etn-certificacao-cq-db-prod` (ID: `8da94645-7e04-42d0-9105-150246b98b2a`)  
**Regime Operacional:** Exclusivamente local. Zero chamadas à Cloudflare, zero execuções remotas.

---

### 1. SCHEMA EXATO DA MIGRATION 0001

Abaixo é apresentado o detalhamento formal e exato de cada tabela que compõe o arquivo `migrations/0001_cq_authorization.sql`:

#### 1.1. Tabela `cq_app_access`
- **Finalidade:** Registro de autorização do colaborador no aplicativo Certificação CQ.
- **Colunas:**
  - `id` (`TEXT`): **PRIMARY KEY**. Identificador interno único (UUID v4).
  - `etn_user_id` (`TEXT`): **NOT NULL**, **UNIQUE**. ID canônico do usuário na autoridade central (ETN Materiais).
  - `enabled` (`INTEGER`): **NOT NULL**, **DEFAULT 1**, **CHECK (enabled IN (0, 1))**. Flag de ativação.
  - `created_at` (`TEXT`): **NOT NULL**, **DEFAULT (datetime('now'))**. Timestamp ISO UTC de concessão.
  - `updated_at` (`TEXT`): **NOT NULL**, **DEFAULT (datetime('now'))**. Timestamp ISO UTC de alteração.
- **Foreign Keys:** Nenhuma (desacoplada de banco externo).
- **Índices:**
  - `sqlite_autoindex_cq_app_access_1` (implícito pelo `PRIMARY KEY (id)`).
  - `sqlite_autoindex_cq_app_access_2` (implícito pelo `UNIQUE (etn_user_id)`).
  - `idx_cq_app_access_enabled` (`CREATE INDEX ON cq_app_access (enabled)`).

#### 1.2. Tabela `cq_app_roles`
- **Finalidade:** Mapeamento de múltiplos papéis por identidade para controle de acesso granular (RBAC).
- **Colunas:**
  - `id` (`TEXT`): **PRIMARY KEY**.
  - `access_id` (`TEXT`): **NOT NULL**, **FOREIGN KEY REFERENCES cq_app_access(id) ON DELETE CASCADE**.
  - `role` (`TEXT`): **NOT NULL**, **CHECK (role IN ('ADMIN', 'GESTOR', 'ANALISTA', 'CQ'))**.
  - `created_at` (`TEXT`): **NOT NULL**, **DEFAULT (datetime('now'))**.
- **Constraint Composta:**
  - **`UNIQUE (access_id, role)`**: Impede atribuição duplicada do mesmo papel para a mesma identidade.
- **Índices:**
  - `sqlite_autoindex_cq_app_roles_1` (implícito pelo `PRIMARY KEY (id)`).
  - `sqlite_autoindex_cq_app_roles_2` (implícito pela constraint composta `UNIQUE (access_id, role)`). O campo `access_id` é a coluna líder deste índice, otimizando junções por `access_id`.
  - `idx_cq_app_roles_role` (`CREATE INDEX ON cq_app_roles (role)`): Otimiza buscas por papel específico (ex: listar todos os `CQ`).

#### 1.3. Tabela `cq_app_scopes`
- **Finalidade:** Delimitação territorial das permissões operacionais estritamente por Unidade Federativa (UF).
- **Colunas:**
  - `id` (`TEXT`): **PRIMARY KEY**.
  - `access_id` (`TEXT`): **NOT NULL**, **FOREIGN KEY REFERENCES cq_app_access(id) ON DELETE CASCADE**.
  - `uf` (`TEXT`): **NOT NULL**, **CHECK (LENGTH(uf) = 2 AND uf GLOB '[A-Z][A-Z]')**. Sigla da UF oficial.
  - `created_at` (`TEXT`): **NOT NULL**, **DEFAULT (datetime('now'))**.
- **Constraint Composta:**
  - **`UNIQUE (access_id, uf)`**: Impede associação duplicada da mesma UF para o mesmo acesso.
- **Índices:**
  - `sqlite_autoindex_cq_app_scopes_1` (implícito pelo `PRIMARY KEY (id)`).
  - `sqlite_autoindex_cq_app_scopes_2` (implícito pela constraint composta `UNIQUE (access_id, uf)`).
  - `idx_cq_app_scopes_uf` (`CREATE INDEX ON cq_app_scopes (uf)`): Otimiza buscas de cobertura territorial por estado.

#### 1.4. Tabela `cq_audit_logs`
- **Finalidade:** Trilha de auditoria e governança de acessos com retenção permanente.
- **Colunas:**
  - `id` (`TEXT`): **PRIMARY KEY**.
  - `event` (`TEXT`): **NOT NULL**, **CHECK (event IN ('ACCESS_GRANTED', 'ACCESS_REVOKED', 'ACCESS_STATUS_CHANGED', 'ROLE_ADDED', 'ROLE_REMOVED', 'SCOPE_ADDED', 'SCOPE_REMOVED'))**.
  - `actor_etn_user_id` (`TEXT`): Identificador do operador que executou a ação (nulo em ações de sistema).
  - `target_etn_user_id` (`TEXT`): **NOT NULL**. Identificador canônico do colaborador afetado.
  - `metadata` (`TEXT`): JSON estruturado com payload da alteração (sem dados sensíveis).
  - `created_at` (`TEXT`): **NOT NULL**, **DEFAULT (datetime('now'))**.
- **Foreign Keys:** **NENHUMA**. (Logs não possuem FK para `cq_app_access` para garantir sua permanência histórica incondicional).
- **Índices:**
  - `idx_cq_audit_logs_target` (`ON cq_audit_logs (target_etn_user_id)`).
  - `idx_cq_audit_logs_event` (`ON cq_audit_logs (event)`).
  - `idx_cq_audit_logs_created_at` (`ON cq_audit_logs (created_at DESC)`).

---

### 2. AUDITORIA: `cq_app_access`

- **Obrigatoriedade e Unicidade:** O campo `etn_user_id` possui `NOT NULL` e `UNIQUE`. Foi comprovado em teste unitário que nulos e duplicatas são abortados com erro fatal de constraint.
- **Flag `enabled`:** Tipada como `INTEGER` com `CHECK (enabled IN (0, 1))`. Em SQLite e D1, tipos booleanos são formalmente representados como inteiros binários. Valores fora de 0 e 1 são bloqueados.
- **Timestamps:** Ambos `created_at` e `updated_at` utilizam a função determinística nativa `(datetime('now'))`, garantindo formato ISO-8601 UTC padronizado em todas as inserções.
- **Segurança da Informação:** Não existem colunas como `password`, `password_hash`, `salt`, `token`, `session_id` ou cookies. O banco D1 do CQ atua como consumidor estrito de identidade e autoridade de governança local.

---

### 3. AUDITORIA: `cq_app_roles`

- **Integridade Referencial:** Possui constraint explícita `REFERENCES cq_app_access(id) ON DELETE CASCADE`.
- **Múltiplos Papéis:** Um colaborador pode acumular simultaneamente papéis (exemplo: `ANALISTA` e `CQ`), atendendo à necessidade operacional de colaboradores de escritório que também executam avaliações em campo.
- **Anti-Duplicação:** A constraint `UNIQUE (access_id, role)` impede fisicamente a inserção do mesmo papel duas vezes para a mesma identidade.
- **Whitelist Restrita de Papéis:**
  ```sql
  CHECK (role IN ('ADMIN', 'GESTOR', 'ANALISTA', 'CQ'))
  ```
- **Confirmação de Rejeição:** Papéis externos ou fora de escopo operacional do CQ (`MULTIPLICADOR`, `TECNICO`, etc.) falham imediatamente com erro de `CHECK constraint failed`.

---

### 4. AUDITORIA: `cq_app_scopes` (SIMPLIFICAÇÃO TERRITORIAL)

- **Diagnóstico Crítico da Versão Anterior:** A versão preliminar continha `scope_type IN ('UF', 'BASE', 'PARTNER')` e `scope_value TEXT`. Isso introduzia prematuramente a semântica de "Polo/Base" e "Parceiro" antes da homologação dessas entidades no domínio do CQ.
- **Refinamento Aplicado:** A tabela foi simplificada e especializada exclusivamente para **UF**:
  - Coluna `uf TEXT NOT NULL`.
  - Constraint `UNIQUE (access_id, uf)`.
- **Benefício:** Elimina sobrecarga conceitual, simplifica consultas SQL na borda e não congela conceitos prematuros no schema base.

---

### 5. AUDITORIA: REGRA DE VALIDAÇÃO DE UF

- **Constraint Implementada:**
  ```sql
  CHECK (LENGTH(uf) = 2 AND uf GLOB '[A-Z][A-Z]')
  ```
- **Comportamento Validado em Teste:**
  - Valores válidos aceitos: `'SP'`, `'RJ'`, `'MG'`, `'PR'`, etc.
  - Valores rejeitados com erro:
    - `'PARANA'` (rejeitado por `LENGTH != 2`);
    - `'P'` (rejeitado por `LENGTH != 2`);
    - `'PR1'` (rejeitado por conter dígito);
    - `'sp'` (rejeitado por conter minúsculas);
    - `'12'`, `''`, etc.
- **Decisão Técnica:** O uso de `GLOB '[A-Z][A-Z]'` associado ao `LENGTH = 2` provê proteção contra strings malformadas com custo computacional nulo, dispensando o hardcode das 27 UFs em DDL e mantendo flexibilidade sem risco de dados corrompidos.

---

### 6. AUDITORIA: `cq_audit_logs`

- **Rastreabilidade e Governança:**
  - Registra o evento através da coluna `event` (`ACCESS_GRANTED`, `ACCESS_REVOKED`, `ACCESS_STATUS_CHANGED`, `ROLE_ADDED`, `ROLE_REMOVED`, `SCOPE_ADDED`, `SCOPE_REMOVED`).
  - Identifica o operador (`actor_etn_user_id`) e a identidade afetada (`target_etn_user_id`).
  - O campo `metadata` permite registrar dados contextuais (ex: papéis concedidos, UFs associadas) em formato JSON.
- **Isenção Total de Dados Sensíveis:** O design do log e o código da aplicação proíbem expressamente a gravação de senhas, hashes, segredos ou tokens.
- **Política ON DELETE e Imutabilidade:**
  - **A tabela `cq_audit_logs` NÃO possui FOREIGN KEY referenciando `cq_app_access(id)`.**
  - **Motivo de Engenharia:** Em auditoria forense corporativa, a trilha de logs jamais pode ser apagada por efeito colateral (CASCADE) quando um acesso de colaborador for excluído do sistema. Os logs devem persistir de forma definitiva.

---

### 7. DELETE DE ACESSO: CASCATA x PRESERVAÇÃO

A validação em teste automatizado comprovou:
- Ao executar `DELETE FROM cq_app_access WHERE id = ?`:
  - `cq_app_roles` associadas: **REMOVIDAS EM CASCATA (`ON DELETE CASCADE`)**;
  - `cq_app_scopes` associadas: **REMOVIDAS EM CASCATA (`ON DELETE CASCADE`)**;
  - `cq_audit_logs` correspondentes: **PRESERVADAS INTEGRALMENTE NO BANCO**.

---

### 8. DIRETRIZ OPERACIONAL: DESABILITAR (`enabled = 0`) x EXCLUIR (`DELETE`)

- **Regra Operacional Recomendada:**
  - **Revogação / Suspensão Ordinária:** A API e o painel administrativo devem priorizar a alteração `UPDATE cq_app_access SET enabled = 0, updated_at = datetime('now') WHERE etn_user_id = ?`.
  - **Justificativa:** Preserva a associação dos papéis e das UFs para auditoria e histórico de avaliações já executadas no passado por aquele inspetor de CQ.
  - **Exclusão Física (`DELETE`):** Reservada estritamente para expurgo administrativo de registros criados por engano ou exigências legais expressas (LGPD/Direito ao Esquecimento).

---

### 9. AUDITORIA DE ÍNDICES: ELIMINAÇÃO DE REDUNDÂNCIAS

Na auditoria foram identificadas e removidas redundâncias desnecessárias para otimização de escrita no D1:

1. **Removido:** `idx_cq_app_access_etn_user_id` — A coluna `etn_user_id` já possui `UNIQUE`, gerando automaticamente um índice B-Tree pelo SQLite.
2. **Removido:** `idx_cq_app_roles_access_id` — A constraint `UNIQUE (access_id, role)` já cria um índice onde `access_id` é a coluna líder (`leftmost`), tornando um índice secundário redundante.
3. **Removido:** `idx_cq_app_scopes_access_id` — Pelo mesmo motivo, a constraint `UNIQUE (access_id, uf)` já indexa o `access_id`.
4. **Mantidos:**
   - `idx_cq_app_access_enabled`: Filtragem rápida de colaboradores com acesso ativo.
   - `idx_cq_app_roles_role`: Busca de colaboradores por papel (ex: `WHERE role = 'CQ'`).
   - `idx_cq_app_scopes_uf`: Busca por cobertura territorial (ex: `WHERE uf = 'SP'`).
   - `idx_cq_audit_logs_target`, `event`, `created_at`: Consultas forenses e cronológicas.

---

### 10. COMPATIBILIDADE CLOUDFLARE D1 / SQLITE

- Todas as cláusulas utilizadas (`CREATE TABLE IF NOT EXISTS`, `CHECK`, `REFERENCES ... ON DELETE CASCADE`, `datetime('now')`, `GLOB`, `UNIQUE`) são nativamente suportadas pela engine SQLite do Cloudflare D1.
- Não há uso de sintaxes proprietárias de PostgreSQL, tipos complexos (`UUID`, `JSONB`, `TIMESTAMPTZ`) ou extensões de terceiros.
- Tipos adotados: `TEXT` (strings, ISO timestamps, UUIDs) e `INTEGER` (flags binárias).

---

### 11. IDEMPOTÊNCIA E DISCIPLINA DE VERSIONAMENTO

- O Cloudflare D1 gerencia migrations de forma estrita através de sua tabela interna `d1_migrations`.
- O arquivo `migrations/0001_cq_authorization.sql` é o **bloco inaugural (0001)**. Uma vez aplicado na Cloudflare, ele se torna **imutável**.
- Quaisquer adições futuras (catálogo de certificações, itens de checklist, avaliações práticas) serão implementadas como `0002_*.sql`, `0003_*.sql`, etc., mantendo o histórico de alterações rastreável e reproduzível.

---

### 12. RESULTADO DA AUDITORIA E DIFF LÓGICO

- **Classificação:** **`APPROVED`** (com refinamentos aplicados antes de qualquer submissão a produção).

#### Diff Lógico da Migration 0001:
```diff
--- a/migrations/0001_cq_authorization.sql (preliminar)
+++ b/migrations/0001_cq_authorization.sql (refinada e aprovada)
@@ -14,5 +14,4 @@
-CREATE UNIQUE INDEX IF NOT EXISTS idx_cq_app_access_etn_user_id ON cq_app_access (etn_user_id);
 CREATE INDEX IF NOT EXISTS idx_cq_app_access_enabled ON cq_app_access (enabled);
 
@@ -28,3 +27,2 @@
-CREATE INDEX IF NOT EXISTS idx_cq_app_roles_access_id ON cq_app_roles (access_id);
 CREATE INDEX IF NOT EXISTS idx_cq_app_roles_role ON cq_app_roles (role);
 
-CREATE TABLE IF NOT EXISTS cq_app_scopes (
-  id TEXT PRIMARY KEY,
-  access_id TEXT NOT NULL REFERENCES cq_app_access(id) ON DELETE CASCADE,
-  scope_type TEXT NOT NULL DEFAULT 'UF' CHECK (scope_type IN ('UF', 'BASE', 'PARTNER')),
-  scope_value TEXT NOT NULL,
-  created_at TEXT NOT NULL DEFAULT (datetime('now')),
-  UNIQUE (access_id, scope_type, scope_value)
-);
-CREATE INDEX IF NOT EXISTS idx_cq_app_scopes_access_id ON cq_app_scopes (access_id);
-CREATE INDEX IF NOT EXISTS idx_cq_app_scopes_value ON cq_app_scopes (scope_type, scope_value);
+CREATE TABLE IF NOT EXISTS cq_app_scopes (
+  id TEXT PRIMARY KEY,
+  access_id TEXT NOT NULL REFERENCES cq_app_access(id) ON DELETE CASCADE,
+  uf TEXT NOT NULL CHECK (LENGTH(uf) = 2 AND uf GLOB '[A-Z][A-Z]'),
+  created_at TEXT NOT NULL DEFAULT (datetime('now')),
+  UNIQUE (access_id, uf)
+);
+CREATE INDEX IF NOT EXISTS idx_cq_app_scopes_uf ON cq_app_scopes (uf);
```

---

### 13. GATES DE QUALIDADE

1. **Testes da Migration (`test/d1-migrations.test.ts`):** **PASS** (10/10 testes aprovados).
2. **Testes Gerais (`test/auth-2b-etn-adapter.test.ts`):** **PASS** (16/16 testes aprovados).
3. **Suíte Geral (`npm test`):** **PASS** (26/26 testes aprovados sem falhas).
4. **Typecheck (`npm run lint` / `tsc --noEmit`):** **PASS** (0 erros de tipagem).
5. **Build (`npm run build`):** **PASS** (Compilação concluída com sucesso).

---

### CONFIRMAÇÕES FINAIS OBRIGATÓRIAS

- **MIGRATION 0001:** **APPROVED**
- **TESTES MIGRATION:** **PASS**
- **TESTES GERAIS:** **PASS**
- **TYPECHECK:** **PASS**
- **BUILD:** **PASS**

- **D1 PRODUÇÃO ALTERADO:** **NÃO**
- **MIGRATION PRODUÇÃO EXECUTADA:** **NÃO**
- **WORKER CRIADO:** **NÃO**
- **PAGES CRIADO:** **NÃO**
- **DEPLOY REALIZADO:** **NÃO**
- **MATERIAIS ALTERADO:** **NÃO**
- **SIMULADORES ALTERADO:** **NÃO**

---

**STOP.**  
Auditoria técnica da migration 0001 concluída. O arquivo local está refinado, testado e pronto para aplicação quando autorizado. Nenhuma alteração foi realizada em ambiente Cloudflare.
