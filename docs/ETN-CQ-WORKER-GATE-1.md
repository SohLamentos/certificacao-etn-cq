# ETN CERTIFICAÇÃO CQ — WORKER GATE 1
## PREPARAÇÃO DO BACKEND CLOUDFLARE WORKER NATIVO

**Data:** 29 de Setembro de 2026  
**Status do Gate:** WORKER CODE PREPARED, TESTED AND COMPILED (100% PASS)  
**Worker:** `etn-certificacao-cq-api` (Local Codebase Ready)  
**Banco D1 Vinculado:** `etn-certificacao-cq-db-prod` (`8da94645-7e04-42d0-9105-150246b98b2a`)  
**Service Binding Alvo:** `MAT_API` -> `etn-materiais-api`  

---

### A. ARQUITETURA WORKER

A arquitetura do backend de produção do Certificação CQ foi inteiramente convertida para execução nativa como **Cloudflare Worker** (V8 isolate serverless edge), estabelecendo uma separação estrita:

- **Ambiente de Desenvolvimento / Preview (LEGACY / DEV):**  
  Mantido em `server.ts` e `src/server/` para suporte ao dev server e Vite no container AI Studio na porta 3000.
- **Ambiente de Produção Edge (CLOUDFLARE WORKER PROD):**  
  Estruturado sob o diretório canônico `src/worker/`, desacoplado de dependências legadas Node.js:
  - **Zero dependência de:** `express`, `cookie-parser`, `node:fs`, `node:net`, `pg`, `bcryptjs`, ou servidores persistentes.
  - **Uso estrito de:** Web Standards API (`Request`, `Response`, `Headers`, `URL`, `crypto.randomUUID()`) e bindings Cloudflare.

---

### B. ROUTER (DECISÃO TÉCNICA)

- **Opção Escolhida:** **A) Fetch API nativa**.
- **Justificativa:**
  1. **Consistência Ecossistêmica:** Segue exatamente o padrão de roteamento nativo adotado na API do `etn-simuladores`.
  2. **Sobrecarga Zero:** Elimina dependências externas ou frameworks adicionais (como Hono ou Express), minimizando a superfície de ataque e o tamanho do artefato bundle final (apenas 21.6 KB).
  3. **Performance:** Execução direta no isolate V8 sem intermediários desnecessários.
  4. **Controle Total:** Roteamento determinístico em `src/worker/app.ts` com pattern matching transparente de método e `pathname`.

---

### C. ENV TIPADO

Definido formalmente em `src/worker/types.ts`:

```typescript
export interface Env {
  DB: D1Database;
  MAT_API: Fetcher;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
}
```

Nenhum segredo ou token confidencial é exposto em código ou variáveis.

---

### D. D1 REPOSITORY (`CQAuthorizationRepository`)

Implementado em `src/worker/db/cqD1Repository.ts`:
- **Isolamento e Segurança:** 100% das operações utilizam statements parametrizados com `db.prepare(...).bind(...)`.
- **Zero concatenação de strings em SQL.**
- **Métodos Implementados:**
  - `findAccessByEtnUserId(db, etnUserId)`: Busca do acesso habilitado por UUID canônico.
  - `getRoles(db, accessId)`: Listagem dos papéis operacionais (`cq_app_roles`).
  - `getScopes(db, accessId)`: Listagem das UFs associadas (`cq_app_scopes`).
  - `isEnabled(db, etnUserId)`: Validação booleana rápida (`enabled === 1`).
  - `grantAccess(db, etnUserId, roles, ufs, actorUserId)`: Concessão atômica via `db.batch(...)`.
  - `disableAccess(db, etnUserId, actorUserId)`: Suspensão lógica (`enabled = 0`).
  - `enableAccess(db, etnUserId, actorUserId)`: Reativação lógica (`enabled = 1`).
  - `setRoles(db, accessId, roles)`: Substituição atômica de roles.
  - `setScopes(db, accessId, ufs)`: Substituição atômica de UFs.
  - `logAudit(db, event, actorUserId, targetUserId, metadata)`: Registro forense em `cq_audit_logs`.

---

### E. ETN IDENTITY PROVIDER (`EtnIdentityProvider`)

Implementado em `src/worker/auth/etnProvider.ts`:
- Consome a autoridade central ETN Materiais via **Service Binding nativo** `env.MAT_API`.
- **Contrato Real Auditado:**
  - `POST /api/auth/login` (payload: `{ login, password }`) ➔ Retorna token central Bearer e perfil canônico.
  - `GET /api/auth/me` (header: `Authorization: Bearer <token>`) ➔ Valida token e retorna identidade do colaborador.
  - `POST /api/auth/logout` (header: `Authorization: Bearer <token>`) ➔ Revoga sessão na autoridade central.
- **Fail-Closed:** Se `env.MAT_API` estiver indisponível ou retornar erro 5xx, a aplicação rejeita o acesso imediatamente com HTTP 502 (`ETN_AUTH_UNAVAILABLE`).
- **Segurança Estrita:** Senhas e tokens nunca são armazenados ou impressos em logs.

---

### F. TOKEN FLOW (ARQUITETURA STATELESS)

1. **Browser** envia credenciais via `POST /api/auth/login`.
2. **Worker CQ** encaminha autenticação para `MAT_API` (`etn-materiais-api`).
3. Se válido, o **Worker CQ** consulta `env.DB` (`cq_app_access`) pelo UUID retornado.
4. Se o usuário possuir acesso habilitado (`enabled = 1`), retorna o token central ETN e as roles locais ao browser. Se não possuir, bloqueia com HTTP 403 `APPLICATION_ACCESS_DENIED`.
5. Em requisições protegidas subsequentes:
   - Header: `Authorization: Bearer <token ETN>`.
   - Worker CQ valida token em `MAT_API` (`GET /api/auth/me`).
   - Identidade validada ➔ Consulta `cq_app_access`, `cq_app_roles` e `cq_app_scopes` no D1 ➔ Autoriza requisição.

---

### G. AUTH MIDDLEWARE

Implementado em `src/worker/auth/middleware.ts`:
- `requireEtnIdentity`: Exige header Bearer e valida contra o Materiais (retorna 401 em falta ou expiração, 502 em falha de rede).
- `requireCqAccess`: Exige identidade ETN válida + registro de acesso existente no D1 + flag `enabled = 1` (retorna 403 `APPLICATION_ACCESS_DENIED` se ausente ou desabilitado).

---

### H. RBAC (ROLE-BASED ACCESS CONTROL)

- **Papéis Admitidos no CQ:** `'ADMIN'`, `'GESTOR'`, `'ANALISTA'`, `'CQ'`.
- **Roles Centralizadas Rejeitadas como Locais:** `MULTIPLICADOR` e `TECNICO` são papéis centrais da rede e **não** constituem roles locais de operação do CQ.
- **Guard:** `requireCqRole(context, ['ADMIN'])` retorna 403 `FORBIDDEN` se o colaborador não detiver o perfil exigido.
- **Suporte Multi-Role:** Uma mesma identidade física pode deter múltiplos perfis (ex: `ANALISTA` e `CQ`).
- **Anti-Spoofing:** Quaisquer roles enviadas no corpo da requisição pelo cliente são descartadas; prevalecem unicamente as roles persistidas no D1.

---

### I. ENDPOINTS IMPLEMENTADOS

| Método | Endpoint | Proteção | Resposta |
|---|---|---|---|
| `GET` | `/api/health` | Pública | Teste de vivacidade do Worker e conectividade com D1 (`SELECT 1`). Não expõe segredos. |
| `POST` | `/api/auth/login` | Pública | Autentica no Materiais via Service Binding e valida concessão local no CQ. |
| `GET` | `/api/auth/me` | Bearer Token | Retorna identidade do colaborador validada na autoridade central. |
| `POST` | `/api/auth/logout` | Bearer Token | Revoga sessão na autoridade central. |
| `GET` | `/api/cq/me` | Bearer + CQ Access | Retorna identidade sanitizada, dados do acesso CQ, roles e escopo de UFs. |
| `GET` | `/api/admin/probe` | Bearer + CQ ADMIN | Retorna 200 para administradores locais do CQ; 403 para os demais. |

---

### J. POLÍTICA DE CORS

Implementada em `src/worker/cors.ts`:
- Origens permitidas: `https://etn-certificacao-cq.pages.dev`, `https://etn-certificacao-cq.claro.com.br`, `http://localhost:3000`, `http://localhost:5173`, além de origens configuráveis via `env.ALLOWED_ORIGINS`.
- **Segurança:** **NUNCA** emite `Access-Control-Allow-Origin: *` em rotas com credenciais/autenticação.
- Suporte a preflight via requisições `OPTIONS` com status 204.

---

### K. WRANGLER CONFIGURAÇÃO (`wrangler.toml`)

```toml
# Configuration for Cloudflare Worker: etn-certificacao-cq-api
# Pre-Gate 1: Prepared for future deployment (DO NOT DEPLOY YET)

name = "etn-certificacao-cq-api"
main = "src/worker/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"
API_VERSION = "v1"

# Banco D1 de Produção do Certificação CQ (Criado e migrado na Cloudflare)
[[d1_databases]]
binding = "DB"
database_name = "etn-certificacao-cq-db-prod"
database_id = "8da94645-7e04-42d0-9105-150246b98b2a"
migrations_dir = "migrations"

# Service Binding nativo para a autoridade central de identidade (ETN Materiais)
[[services]]
binding = "MAT_API"
service = "etn-materiais-api"
```

---

### L. COMPATIBILIDADE CLOUDFLARE WORKERS

- Bundle de produção gerado via esbuild: `dist/worker.js` (21.6 KB).
- **Auditoria de imports:** 100% limpo. Zero ocorrências de `express`, `cookie-parser`, `node:fs`, `node:net`, `pg`, `bcryptjs`.
- Compatível integralmente com a runtime edge V8 da Cloudflare.

---

### M. TESTES AUTOMATIZADOS (18 CENÁRIOS HOMOLOGADOS)

Arquivo criado: `test/worker-cq.test.ts`.  
Executado com mocks de D1 (SQLite nativo) e `MAT_API` (Fetch Service Binding mock):

1. `GET /api/health` com DB disponível ➔ `PASS` (HTTP 200, sem vazamento de IDs).
2. Token ausente na requisição protegida ➔ `PASS` (HTTP 401).
3. Token inválido/expirado ➔ `PASS` (HTTP 401).
4. Provedor central `MAT_API` indisponível ➔ `PASS` (HTTP 502 Fail-closed).
5. Identidade válida no ETN sem registro no CQ ➔ `PASS` (HTTP 403 `APPLICATION_ACCESS_DENIED`).
6. Identidade com acesso CQ suspenso (`enabled = 0`) ➔ `PASS` (HTTP 403 `APPLICATION_ACCESS_DENIED`).
7. Identidade válida com acesso CQ habilitado (`enabled = 1`) ➔ `PASS` (HTTP 200 em `/api/cq/me`).
8. `ADMIN` local autorizado ➔ `PASS` (HTTP 200 em `/api/admin/probe`).
9. `GESTOR` local ➔ `PASS` (HTTP 403 `FORBIDDEN` em `/api/admin/probe`).
10. `ANALISTA` local ➔ `PASS` (HTTP 403 `FORBIDDEN` em `/api/admin/probe`).
11. `CQ` local ➔ `PASS` (HTTP 403 `FORBIDDEN` em `/api/admin/probe`).
12. Suporte a múltiplas roles locais simultâneas (`ANALISTA` + `CQ`) ➔ `PASS`.
13. Proteção contra SQL Injection via statements parametrizados ➔ `PASS`.
14. Role enviada pelo browser ignorada (prevalece a do D1) ➔ `PASS`.
15. Manipulação de cookies/localStorage rejeitada ➔ `PASS` (HTTP 401).
16. Ausência de colunas de senha/hash no D1 ➔ `PASS`.
17. Ausência de vazamento de token no payload de resposta ➔ `PASS`.
18. Ausência de tokens/senhas em `cq_audit_logs` ➔ `PASS`.

**Resultado da suíte global (`npm test`): 44 testes executados em 3 suites, 44 aprovados (100% PASS).**

---

### N. GATES LOCAIS DO PROJETO

- **Testes Unitários Totais (`npm test`):** **44/44 PASS**.
- **Typecheck (`npm run lint` / `tsc --noEmit`):** **PASS** (Zero erros de tipagem).
- **Build Worker (`npm run build:worker`):** **PASS** (`dist/worker.js` gerado).
- **Build Applet / Vite (`vite build`):** **PASS**.

---

### O. PRÓXIMO PASSO

Aguardar autorização formal para o próximo gate:
1. Publicação/Deploy controlado do Worker `etn-certificacao-cq-api` na Cloudflare.
2. Associação dos bindings `DB` (`etn-certificacao-cq-db-prod`) e `MAT_API` (`etn-materiais-api`).
3. Concessão controlada do primeiro acesso administrativo local via D1.

---

### CONFIRMAÇÕES FINAIS OBRIGATÓRIAS

- **WORKER CODE READY:** **SIM**
- **D1 BINDING CODE READY:** **SIM**
- **MAT_API BINDING CODE READY:** **SIM**
- **WORKER BUILD:** **PASS**
- **TESTES:** **PASS** (44/44 testes aprovados)

**Garantias de isolamento:**
- **WORKER REMOTO CRIADO:** **NÃO**
- **PAGES CRIADO:** **NÃO**
- **DEPLOY REALIZADO:** **NÃO**
- **D1 PRODUÇÃO ALTERADO:** **NÃO**
- **MATERIAIS ALTERADO:** **NÃO**
- **SIMULADORES ALTERADO:** **NÃO**

---

**STOP.**  
Backend Cloudflare Worker preparado, auditado, testado e compilado localmente. Nenhuma operação de deploy ou escrita remota foi efetuada. Aguardando aprovação para o próximo gate.
