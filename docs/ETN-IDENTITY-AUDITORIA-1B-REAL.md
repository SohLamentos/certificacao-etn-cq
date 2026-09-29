# ETN IDENTITY — AUDITORIA 1B REAL
## AUTENTICAÇÃO COMPARTILHADA — MATERIAIS + SIMULADORES
### ESTRATÉGIA DE CONSUMO PELO NOVO ETN CERTIFICAÇÃO CQ

**Data da Auditoria:** 29 de Setembro de 2026  
**Tipo de Auditoria:** Estática Read-Only baseada 100% em código-fonte local  
**Classificação das Evidências:**  
- **[FATO COMPROVADO]:** Extraído diretamente do código, migrations ou configurações dos repositórios locais auditados.  
- **[INFERÊNCIA]:** Dedução técnica fundamentada exclusivamente nas evidências comprovadas.  
- **[PROPOSTA]:** Desenho da integração do Certificação CQ para consumo sem interferência.  

---

### A. BASELINE AUDITADO

Os clones locais foram verificados estaticamente no diretório temporário isolado `/tmp/etn-identity-audit/`:

1. **Repositório ETN Materiais:**
   - **Path local:** `/tmp/etn-identity-audit/etn-materiais`
   - **Branch:** `main`
   - **HEAD SHA:** `4c449fc522e30d8a8fcb0d46e0d5c4e8d983f511`
   - **Git Status:** Limpo (`git status --short` vazio)
   - **Configuração de Runtime:** `wrangler.jsonc` (Cloudflare Worker `etn-materiais-api`, binding D1 `DB` apontando para `etn-materiais-db-prod`, ID `a17a03bc-7cee-495b-81f0-01788ab2d41b`).

2. **Repositório ETN Simuladores:**
   - **Path local:** `/tmp/etn-identity-audit/etn-simuladores`
   - **Branch:** `main`
   - **HEAD SHA:** `fbec55e778c0ffc54c7037a8d237ca0e804d6d96`
   - **Git Status:** Limpo (`git status --short` vazio)
   - **Configuração de Runtime:** `api/wrangler.toml` (Cloudflare Worker `etn-simuladores-api`, binding Service `MAT_API` apontando para o Worker `etn-materiais-api`, binding D1 `SIMULADORES_DB` ID `6ceca75d-18bf-4b60-97bf-d0cb15a7be7b`).

---

### B. AUTORIDADE DE IDENTIDADE ATUAL

- **[FATO COMPROVADO]** A autoridade central e exclusiva de identidade de todo o ecossistema ETN é o **`etn-materiais-api`**.
- **[FATO COMPROVADO]** O banco de dados **D1 `etn-materiais-db-prod`** é a fonte da verdade onde residem as credenciais (`login`, `password_hash`), status de usuário, sessões ativas (`sessions`) e registros de auditoria de login (`login_attempts`, `audit_logs`).
- **[FATO COMPROVADO]** O **ETN Simuladores não possui tabela de usuários ou senhas em seu próprio D1** (`etn-simuladores-db-prod`). Todas as migrations do Simuladores (`migrations/0001_simulator_core.sql` e `migrations/0002_class_activities.sql`) tratam unicamente de turmas, atividades, checkpoints e execuções de simulação técnica, referenciando usuários por seus IDs de texto (`user_id`, `created_by`).
- **[FATO COMPROVADO]** O ETN Simuladores opera 100% como cliente satélite consumidor da autoridade de autenticação do Materiais.

---

### C. SCHEMA REAL DE IDENTIDADE (ETN MATERIAIS)

Auditoria das migrations SQL em `migrations/` do repositório `etn-materiais`:

1. **Tabela `users` (`migrations/0001_users_and_groups.sql`, linhas 4-16 e `migrations/0025_add_user_partner_and_state.sql`, linhas 2-4):**
   - `id TEXT PRIMARY KEY`: UUID v4 gerado no backend (`crypto.randomUUID()`).
   - `display_name TEXT NOT NULL`: Nome completo de exibição do usuário.
   - `login TEXT NOT NULL UNIQUE`: Identificador corporativo único (normalizado em minúsculas).
   - `email TEXT UNIQUE`: E-mail corporativo (opcional/anulável).
   - `role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'ANALYST', 'MULTIPLIER'))`: Perfil único na tabela central. *(Nota: O tipo TypeScript `worker/types/env.ts` já contempla `'CQ'`, mas o CHECK original da migration 0001 foi concebido para os 4 perfis centrais).*
   - `status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'))`.
   - `password_hash TEXT`: Hash seguro da senha gerado via PBKDF2-SHA256 (anulável para usuários sem senha configurada).
   - `state TEXT`: UF de vinculação operacional direta do usuário (adicionada na migration 0025).
   - `partner_id TEXT REFERENCES partners(id)`: Chave estrangeira para a empresa parceira contratada (migration 0025).
   - `partner_name TEXT`: Razão social/nome fantasia da parceira denormalizado (migration 0025).
   - `last_login_at TEXT`: Timestamp ISO atualizado a cada login bem-sucedido.
   - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`.
   - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`.
   - `deleted_at TEXT`: Timestamp para suporte a soft-delete.
   - **Índices Comprovados:** `idx_users_login`, `idx_users_email`, `idx_users_role`, `idx_users_status`, `idx_users_partner_id`, `idx_users_state`.

2. **Tabela `sessions` (`migrations/0010_reports_audit_sessions.sql`, linhas 37-47):**
   - `id TEXT PRIMARY KEY`: UUID v4 da sessão.
   - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT`.
   - `token_hash TEXT NOT NULL UNIQUE`: Hash SHA-256 do token opaco gerado.
   - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`.
   - `expires_at TEXT NOT NULL`: Timestamp ISO de expiração (padrão de 8 horas = 480 minutos).
   - `revoked_at TEXT`: Timestamp ISO preenchido na revogação (logout ou troca de senha).
   - `last_used_at TEXT`: Timestamp de atividade registrado assincronamente via `waitUntil`.
   - `ip_hash TEXT`: Hash do IP do cliente para auditoria forense.
   - `user_agent TEXT`: Identificador do navegador/dispositivo do cliente.
   - **Constraint:** `CHECK (expires_at > created_at)`.

3. **Tabela `login_attempts` (`migrations/0012_auth_security.sql`, linhas 4-11):**
   - `id TEXT PRIMARY KEY`, `login TEXT NOT NULL`, `ip_hash TEXT`, `successful INTEGER NOT NULL DEFAULT 0 CHECK (successful IN (0, 1))`, `reason TEXT`, `attempted_at TEXT NOT NULL DEFAULT (datetime('now'))`.

4. **Tabela `user_group_assignments` (`migrations/0001` / `0020` / `worker/repositories/user-group-assignment.repository.ts`):**
   - Vincula `user_id` a `group_id` (`management_groups.id`), indicando `is_primary` (0 ou 1) e período de vigência (`start_date`, `end_date`).

---

### D. FLUXO REAL DE LOGIN (ETN MATERIAIS)

- **Localização:**  
  - Rota: `POST /api/auth/login` (`worker/routes/auth.routes.ts`, linha 10)  
  - Controller: `AuthController.login` (`worker/controllers/auth.controller.ts`, linhas 6-36)  
  - Service: `AuthService.login` (`worker/services/auth.service.ts`, linhas 35-215)

- **Etapas Executadas:**
  1. O cliente submete `{ login, password }`.
  2. A rota aplica rate limiting em memória: máximo de 10 tentativas a cada 15 minutos por IP (`rateLimiter({ maxAttempts: 10, windowMinutes: 15 })`).
  3. O login é normalizado: `login.trim().toLowerCase()`.
  4. Consulta o D1: `SELECT id, login, display_name, role, status, password_hash FROM users WHERE LOWER(login) = ? LIMIT 1`.
  5. **Defesa contra Enumeração:** Se o usuário não existir ou `status !== 'ACTIVE'`, registra falha em `login_attempts` e `audit_logs` e devolve mensagem genérica com `HTTP 401 INVALID_CREDENTIALS` (*"Credenciais inválidas ou usuário inativo."*).
  6. **Validação de Senha:** Verifica a senha submetida contra `password_hash` via `verifyPassword(password, user.password_hash)` em tempo constante.
  7. **Geração do Token de Sessão:**
     - Gera 16 bytes criptograficamente aleatórios: `crypto.getRandomValues(new Uint8Array(16))`.
     - Converte para hexadecimal e combina com UUID: `const rawToken = `${crypto.randomUUID()}-${randomHex}`.
     - Calcula o hash SHA-256 do token: `const tokenHash = await hashToken(rawToken)`.
  8. **Persistência da Sessão:**
     - Calcula `expiresAt = Date.now() + 480 minutos` (8 horas).
     - Insere em `sessions` com `(id, userId, tokenHash, expiresAt, ipHash, userAgent)`.
     - Atualiza `last_login_at` em `users`.
  9. **Resposta de Sucesso (HTTP 200):**
     - Retorna o token raw, tipo `Bearer`, data de expiração e o objeto completo do usuário autenticado (incluindo grupos de gestão associados).

---

### E. ARMAZENAMENTO E POLÍTICA DE SENHA

- **Localização:** `worker/security/password.ts` (linhas 1-135)
- **[FATO COMPROVADO] Algoritmo:** **PBKDF2** utilizando a Web Crypto API nativa do Cloudflare Workers (`crypto.subtle.deriveBits`).
- **[FATO COMPROVADO] Função Hash e Iterações:** **SHA-256** com **100.000 iterações**.
- **[FATO COMPROVADO] Salt:** 16 bytes gerados aleatoriamente com `crypto.getRandomValues` para cada senha.
- **[FATO COMPROVADO] Formato de Armazenamento:** `pbkdf2_sha256$<iterations>$<salt_base64>$<hash_base64>`.
- **[FATO COMPROVADO] Comparação:** Executada em tempo constante (`diff |= actualHashBytes[i] ^ expectedHashBytes[i]`) para prevenir ataques de temporização (timing attacks).
- **[FATO COMPROVADO] Validação de Força (`validatePasswordStrength`):**
  - Mínimo 12 caracteres, máximo 128 caracteres.
  - Pelo menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial.
- **[FATO COMPROVADO] Senha Padrão de Carga em Massa:**
  - Arquivo: `worker/config/bulk-auth.config.ts`, linhas 14-38.
  - Valor padrão hardcoded em constante de servidor: `DEFAULT_BULK_MULTIPLIER_INITIAL_PASSWORD = 'Multiplicador@ETN2026!'`.
  - Suporta override via secret/variável de ambiente `BULK_MULTIPLIER_INITIAL_PASSWORD`.
  - Aplicada exclusivamente para novos usuários cadastrados em lote com perfil `MULTIPLIER`.
- **[FATO COMPROVADO] Flag `must_change_password`:** **INEXISTENTE**. Não existe coluna ou flag de troca obrigatória de senha no schema do D1 nem nos modelos de dados de nenhum dos repositórios.

---

### F. TOKEN E GESTÃO DE SESSÃO

- **[FATO COMPROVADO] Tipo de Token:** Token opaco de alta entropia (String no formato `${UUIDv4}-${32_HEX_CHARS}`). **Não é JWT**.
- **[FATO COMPROVADO] Onde é Persistido:**
  - No Servidor (ETN Materiais D1): Salvo na tabela `sessions` sob hash SHA-256 (`token_hash`). O token em texto plano nunca fica no banco.
  - No Cliente (ETN Simuladores): Salvo no `localStorage` do navegador sob a chave `etn_sim_auth_token` (`src/auth/authService.ts`, linha 7).
- **[FATO COMPROVADO] Validação da Sessão:**
  - Implementada em `worker/middleware/auth.middleware.ts` (`resolveAuthenticatedUser`, linhas 18-95).
  - Recebe header `Authorization: Bearer <token>`.
  - Calcula `tokenHash = SHA256(token)`.
  - Busca na tabela `sessions` onde `token_hash = ?`.
  - Rejeita se: registro não for encontrado; `revoked_at` não for nulo; `expires_at <= now`; ou `user.status !== 'ACTIVE'`.
- **[FATO COMPROVADO] Revogação (Logout e Troca de Senha):**
  - `POST /api/auth/logout`: Executa `UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?`.
  - `POST /api/auth/change-password`: Além de alterar o hash da senha, revoga imediatamente todas as sessões ativas do usuário: `UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`.
- **[FATO COMPROVADO] Renovação (`POST /api/auth/refresh`):** Revoga a sessão atual e emite um novo par `(rawToken, tokenHash)` estendendo o tempo de expiração.

---

### G. PERFIS E LIMITAÇÕES

1. **Representação no ETN Materiais (`users.role`):**
   - Valores permitidos na migration: `'ADMIN'`, `'MANAGER'`, `'ANALYST'`, `'MULTIPLIER'`.
   - O campo é uma **coluna única** na tabela `users`.
   - **[FATO COMPROVADO]** Uma identidade física no ETN Materiais **não pode acumular mais de uma role** simultaneamente na base central.
2. **Representação no ETN Simuladores (`UserRole` em `api/src/types.ts`):**
   - Valores: `ADMIN`, `MANAGER`, `ANALYST`, `MULTIPLIER`, `TECHNICIAN`.
   - `TECHNICIAN` existe no Simuladores para identificar o técnico de campo (aluno do simulador), cujos dados de cadastro em Materiais vivem na tabela separada `technicians`.
3. **Mapeamento de Aliases (`api/src/auth/identityVerifier.ts`):**
   - Suporta aliases: `ADMINISTRADOR -> ADMIN`, `GESTOR -> MANAGER`, `ANALISTA -> ANALYST`, `MULTIPLICADOR -> MULTIPLIER`, `TECNICO/TÉCNICO -> TECHNICIAN`.

---

### H. GOVERNANÇA TERRITORIAL

- **[FATO COMPROVADO] Estrutura Canônica (Governança 1.1 — Migration 0047):**
  - **G1:** São Paulo Capital (Apenas `SP`).
  - **G2:** São Paulo Interior + Nordeste (`SP`, `BA`, `CE`, `PB`, `PE`, `PI`, `RN`, `SE`).
  - **G3:** Sul, Centro-Oeste e Norte (`AC`, `AM`, `AP`, `DF`, `GO`, `MS`, `MT`, `PA`, `PR`, `RO`, `RR`, `RS`, `SC`, `TO`).
  - **G4:** Rio de Janeiro, Espírito Santo e Minas Gerais (`RJ`, `ES`, `MG`).
- **[FATO COMPROVADO] Vínculo com Usuários:**
  - Definido na tabela relacional `user_group_assignments(user_id, group_id, is_primary, active)`.
  - O middleware `worker/middleware/auth.middleware.ts` carrega os grupos ativos do usuário e injeta no contexto `authUser.groupCodes` (ex: `['G1', 'G4']`) e `authUser.primaryGroupCode`.
- **[FATO COMPROVADO] Escopo de Execução:**
  - `ADMIN`: Escopo global irrestrito.
  - `MANAGER` / `ANALYST`: O backend filtra consultas e relatórios exigindo que a turma/técnico pertença a um dos grupos ou UFs autorizados para o usuário autenticado.

---

### I. FLUXO REAL DE AUTENTICAÇÃO NO ETN SIMULADORES

Auditoria dos arquivos `src/auth/authService.ts`, `api/src/routes/authRouter.ts` e `api/src/auth/identityVerifier.ts`:

1. **Frontend (Browser):**
   - O usuário preenche e-mail/matrícula e senha em `src/pages/LoginPage.tsx`.
   - `authService.login()` submete `POST /api/auth/login` para a API do Simuladores (`api/src/routes/authRouter.ts`).
2. **Worker do Simuladores (`api/src/routes/authRouter.ts`, linhas 20-80):**
   - Em produção: Encaminha a requisição diretamente para o Worker do Materiais via **Cloudflare Service Binding `MAT_API`**:
     ```typescript
     const upstreamRes = await env.MAT_API.fetch('https://etn-materiais-api/api/auth/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
       body: JSON.stringify({ login, password })
     });
     ```
   - Recebe a resposta do Materiais com o Bearer token e os dados do usuário.
   - Aplica normalização de perfil e devolve para o navegador com `HTTP 200`.
3. **Persistência Local no Browser:**
   - O browser armazena o token recebido do Materiais em `localStorage.setItem('etn_sim_auth_token', token)`.
4. **Requisições Protegidas Subsequentes:**
   - O browser envia o token no header `Authorization: Bearer <token>`.
   - O Worker do Simuladores intercepta a requisição e valida a sessão chamando `verifyIdentityToken` (`api/src/auth/identityVerifier.ts`, linhas 75-105):
     ```typescript
     const resp = await env.MAT_API.fetch('https://etn-materiais-api/api/auth/me', {
       method: 'GET',
       headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
     });
     ```
   - Se o Materiais retornar `HTTP 200`, a identidade é aceita.
   - Se o Materiais retornar erro, a requisição é rejeitada com `HTTP 401 UNAUTHORIZED` (**FAIL-CLOSED estrito**).

---

### J. SERVICE BINDING `MAT_API`

- **[FATO COMPROVADO] O que é:** É um **Cloudflare Worker Service Binding** nativo configurado em `api/wrangler.toml` (`[[services]] binding = "MAT_API", service = "etn-materiais-api"`).
- **[FATO COMPROVADO] Como Opera:**
  - A comunicação ocorre diretamente na malha interna da rede Cloudflare (Worker-to-Worker), sem sair para a internet pública, sem DNS lookup externo e com altíssima performance.
  - O host virtual utilizado na chamada interna é `https://etn-materiais-api`.
- **[FATO COMPROVADO] Fallback:**
  - Fora de produção (em ambiente de desenvolvimento ou CI), caso o binding `MAT_API` não esteja presente, o código utiliza a variável de ambiente `ETN_MATERIAIS_AUTH_URL` (`https://etn-materiais-api.persistentesoficial365.workers.dev`) para efetuar chamadas HTTP externas via `fetch`.
  - Em produção, a ausência de `MAT_API` resulta imediatamente em **FAIL-CLOSED** (`HTTP 503 AUTH_SERVICE_UNAVAILABLE`).

---

### K. CONTRATO AUTH REAL (DOCUMENTAÇÃO DOS ENDPOINTS)

Endpoints reais comprovados no código do `etn-materiais-api`:

#### 1. `POST /api/auth/login`
- **Autenticação:** Nenhuma (Público, com Rate Limit de 10 req/15min).
- **Request Body (JSON):**
  ```json
  {
    "login": "carlos.silva",
    "password": "[REDACTED]"
  }
  ```
- **Response Sucesso (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "token": "4c9d7821-3e4a-4b9e-9d2a-89a1c2d3e4f5-7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e",
      "tokenType": "Bearer",
      "expiresAt": "2026-09-30T06:00:00.000Z",
      "user": {
        "id": "usr_998124a-1122-3344-5566-778899aabbcc",
        "login": "carlos.silva",
        "displayName": "Carlos Eduardo Silva",
        "role": "MANAGER",
        "status": "ACTIVE",
        "groupId": "g4",
        "groupIds": ["g4"],
        "groupCodes": ["G4"],
        "primaryGroupCode": "G4",
        "allowedGroupCodes": ["G4"]
      }
    },
    "requestId": "req_abc123"
  }
  ```
- **Response Erro (HTTP 401):**
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_CREDENTIALS",
      "message": "Credenciais inválidas ou usuário inativo."
    },
    "requestId": "req_abc124"
  }
  ```
- **Consumidores:** Frontend ETN Materiais, Worker ETN Simuladores (`api/src/routes/authRouter.ts`).

#### 2. `GET /api/auth/me`
- **Autenticação:** `Authorization: Bearer <token>`.
- **Response Sucesso (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "id": "usr_998124a-1122-3344-5566-778899aabbcc",
      "login": "carlos.silva",
      "displayName": "Carlos Eduardo Silva",
      "role": "MANAGER",
      "groupId": "g4",
      "groupIds": ["g4"],
      "groupCodes": ["G4"],
      "primaryGroupCode": "G4",
      "allowedGroupCodes": ["G4"],
      "permissions": ["turmas.read", "turmas.create", "technicians.view", ...],
      "sessionExpiresAt": "2026-09-30T06:00:00.000Z"
    },
    "requestId": "req_abc125"
  }
  ```
- **Consumidores:** Worker ETN Materiais, Worker ETN Simuladores (`api/src/auth/identityVerifier.ts`).

#### 3. `POST /api/auth/logout`
- **Autenticação:** `Authorization: Bearer <token>`.
- **Response Sucesso (HTTP 200):**
  ```json
  {
    "success": true,
    "data": { "message": "Sessão encerrada com sucesso." },
    "requestId": "req_abc126"
  }
  ```

#### 4. `POST /api/auth/change-password`
- **Autenticação:** `Authorization: Bearer <token>`.
- **Request Body (JSON):**
  ```json
  {
    "currentPassword": "[REDACTED]",
    "newPassword": "[REDACTED]"
  }
  ```
- **Response Sucesso (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Senha alterada com sucesso. Todas as sessões anteriores foram encerradas. Faça login com a nova senha."
    },
    "requestId": "req_abc127"
  }
  ```

---

### L. GESTÃO DE USUÁRIOS (ETN SIMULADORES -> MATERIAIS)

- **[FATO COMPROVADO]** O ETN Simuladores possui um módulo de governança administrativa completo que atua via proxy transparente para o ETN Materiais (`api/src/governance/governanceAdapter.ts` e `api/src/routes/governanceRouter.ts`).
- **Rotas de Governança Proxy Comprovadas:**
  - `GET /api/governance/users` ➔ Mapeado para `GET /api/v1/users` no Materiais (Listagem paginada de colaboradores).
  - `POST /api/governance/users` ➔ Mapeado para `POST /api/v1/users` no Materiais (Criação de novos usuários na base central).
  - `PATCH /api/governance/users/:id` ➔ Mapeado para `PATCH /api/v1/users/:id` no Materiais (Atualização cadastral e redefinição administrativa de senha).
  - `POST /api/governance/users/:id/activate` ➔ Mapeado para `POST /api/v1/users/:id/activate` no Materiais.
  - `POST /api/governance/users/:id/deactivate` ➔ Mapeado para `POST /api/v1/users/:id/deactivate` no Materiais.
  - `GET /api/governance/groups` ➔ Mapeado para `GET /api/v1/groups` no Materiais.
  - `GET /api/governance/ufs` ➔ Mapeado para `GET /api/v1/states` no Materiais.
- **[INFERÊNCIA]** Na prática, o **`etn-materiais-api` já opera como uma Identity Management API completa** para o ecossistema, consumida remotamente pelo Simuladores.

---

### M. ACHADOS DE SEGURANÇA (AUDITORIA ESTÁTICA)

| # | Item | Classificação | Descrição e Status |
|---|---|---|---|
| 1 | **Hashing de Senhas** | **MÉDIO (CONFORME)** | Implementado com PBKDF2-SHA256, 100.000 iterações, salt individual aleatório e comparação em tempo constante (`worker/security/password.ts`). Totalmente robusto contra ataques de dicionário e rainbow tables. |
| 2 | **Tokens de Sessão** | **BAIXO (CONFORME)** | Tokens opacos de 128+ bits de entropia. No banco reside apenas o hash SHA-256 (`sessions.token_hash`). Mesmo em caso de vazamento de dump do D1, os tokens não podem ser revertidos. |
| 3 | **Token no LocalStorage** | **MÉDIO [ACHADO — FORA DO ESCOPO]** | O frontend do Simuladores armazena o token no `localStorage`. É vulnerável caso ocorra XSS no cliente. *(Não afeta o Certificação CQ, pois o Certificação CQ pode optar por cookies HttpOnly seguros).* |
| 4 | **Validação em Toda Requisição** | **BAIXO (CONFORME)** | O Simuladores valida o token contra o Materiais em cada requisição protegida (`verifyIdentityToken`), garantindo revogação instantânea caso a sessão seja invalidada no Materiais. |
| 5 | **Senha Hardcoded de Multiplicador** | **ALTO [ACHADO — FORA DO ESCOPO]** | `DEFAULT_BULK_MULTIPLIER_INITIAL_PASSWORD = 'Multiplicador@ETN2026!'` em `worker/config/bulk-auth.config.ts`. Novos multiplicadores sem senha recebem este valor se o secret não for configurado no Worker. |
| 6 | **Falta de `must_change_password`** | **MÉDIO [ACHADO — FORA DO ESCOPO]** | Não há no banco central um flag para forçar o usuário a alterar a senha temporária no primeiro acesso. |

---

### N. GAPS ESPECÍFICOS PARA O ETN CERTIFICAÇÃO CQ

1. **Inexistência de Senhas Locais no Certificação CQ:**
   - O Certificação CQ **não deve possuir coluna `password_hash`** em seu banco de dados local. A verificação da credencial do colaborador pertence exclusivamente ao `etn-materiais-api`.
2. **Autorização Local por Papel:**
   - Na autoridade central, o usuário possui `role = 'MANAGER'`, `'ANALYST'` ou `'ADMIN'`.
   - O perfil funcional **`CQ`** (Controle de Qualidade) **não existe na base central**.
   - **Solução:** O Certificação CQ mantém uma tabela local de autorizações que mapeia o `canonical_user_id` para os papéis e permissões internas do CQ (`CQ`, `GESTOR`, `ANALISTA`, `ADMIN`).
3. **Bloqueio Mandatório de Técnicos e Multiplicadores:**
   - Se o login no Materiais autenticar um usuário com perfil central `'MULTIPLIER'` ou `'TECHNICIAN'`, e este usuário não possuir autorização explícita na tabela local do Certificação CQ, o backend do Certificação CQ deve retornar imediatamente `HTTP 403 APPLICATION_ACCESS_DENIED`.

---

### O. INTEGRAÇÃO CQ COM ZERO INTERFERÊNCIA

- **[PROPOSTA DE ARQUITETURA]** O Certificação CQ se tornará um novo consumidor satélite da autoridade central exatamente como o ETN Simuladores, com **ZERO alteração de código ou migrations no ETN Materiais** e **ZERO alteração no ETN Simuladores**:

```
+-----------------------------------------------------------------------------------+
|                              FLUXO DE AUTENTICAÇÃO                                |
+-----------------------------------------------------------------------------------+
  Colaborador (Browser)
          │  POST /api/auth/login  { login, password }
          ▼
  ETN Certificação CQ (Backend Express / Node)
          │
          │  POST /api/auth/login (chama etn-materiais-api)
          ▼
  ETN Materiais API (Cloudflare Worker) ───► Consulta D1 (users, sessions, PBKDF2)
          │
          │  Retorna { token, user: { id: "usr_uuid", login, role, groupCodes } }
          ▼
  ETN Certificação CQ (Backend)
          │
          │  Consulta Tabela Local de Autorização (Cloud SQL PostgreSQL)
          │  SELECT role, ufs FROM cq_user_authorizations WHERE user_id = "usr_uuid"
          │
          ├── Se perfil for MULTIPLIER/TECHNICIAN sem autorização local:
          │     └── Devolve HTTP 403 APPLICATION_ACCESS_DENIED
          │
          └── Se autorizado (ADMIN, GESTOR, ANALISTA, CQ):
                └── Emite Sessão Local do Certificação CQ com os escopos locais
```

- **Vantagens Comprovadas:**
  - **Zero impacto nos sistemas existentes:** Materiais e Simuladores continuam em produção sem qualquer alteração de linha de código.
  - **Single Source of Truth:** Apenas uma senha para o colaborador em todo o ecossistema.
  - **Independência Operacional:** O Certificação CQ define quem é CQ e quais UFs o avaliador pode inspecionar em sua base própria.

---

### P. REGRA DE IDENTIDADE EXISTENTE vs. Claro@123

1. **Para Colaboradores Já Cadastrados no Ecossistema:**
   - **[FATO COMPROVADO]** A identidade já possui `id`, `login` e `password_hash` seguro cadastrados no D1 do Materiais.
   - **Ação:** O Certificação CQ **apenas referencia o `user_id` canônico** em sua tabela de autorizações locais. A senha do usuário **NUNCA É ALTERADA**, e **`Claro@123` NUNCA é aplicada**. O colaborador faz login no Certificação CQ utilizando a mesma senha que já usa no Materiais e no Simuladores.
2. **Para Novos Colaboradores Criados Exclusivamente para o CQ:**
   - Caso um avaliador de CQ precise ser criado no sistema:
     - Ele deve ser registrado na autoridade central através do endpoint `POST /api/v1/users` (ou interface de governança).
     - Como a autoridade central não possui a coluna `must_change_password`, a política de troca obrigatória de senha poderá ser gerida pelo Certificação CQ:
       - No primeiro login bem-sucedido com a senha provisória, o Certificação CQ detecta o status e solicita a chamada ao endpoint `POST /api/auth/change-password` da autoridade central antes de liberar as telas operacionais.

---

### Q. PRÓXIMO GATE

1. Homologação deste relatório pelo operador humano.
2. **Definição da URL de Comunicação com o Materiais:**
   - O Certificação CQ roda em contêiner Node.js (Cloud Run / GCP).
   - Portanto, a comunicação com o `etn-materiais-api` ocorrerá via HTTPS externa:
     `https://etn-materiais-api.persistentesoficial365.workers.dev` (ou domínio oficial corporativo `https://etn-materiais.com/api` quando configurado).
3. Criação do serviço cliente `materiaisAuthClient.ts` no backend do Certificação CQ (`server.ts`).
4. Criação da tabela de autorização local `cq_user_authorizations` no PostgreSQL do Certificação CQ.

---

### CONFIRMAÇÕES FINAIS

- **HEAD MATERIAIS CONFIRMADO:** **SIM** (`4c449fc522e30d8a8fcb0d46e0d5c4e8d983f511`)
- **HEAD SIMULADORES CONFIRMADO:** **SIM** (`fbec55e778c0ffc54c7037a8d237ca0e804d6d96`)

- **AUTH MATERIAIS COMPROVADA:** **SIM**
- **AUTH SIMULADORES COMPROVADA:** **SIM**
- **MAT_API COMPROVADA:** **SIM**
- **CONTRATO AUTH REAL DOCUMENTADO:** **SIM**

- **CERTIFICAÇÃO CQ PODE CONSUMIR AUTH SEM ALTERAR MATERIAIS:** **SIM**
- **CERTIFICAÇÃO CQ PODE CONSUMIR AUTH SEM ALTERAR SIMULADORES:** **SIM**

- **MATERIAIS ALTERADO:** **NÃO**
- **SIMULADORES ALTERADO:** **NÃO**
- **D1 ALTERADO:** **NÃO**
- **CLOUDFLARE ACESSADA:** **NÃO**
- **DEPLOY REALIZADO:** **NÃO**
- **USUÁRIO ALTERADO:** **NÃO**
- **SECRET ALTERADO:** **NÃO**

---

**STOP.**  
Auditoria 1B concluída com rigor estático total e registrada em `docs/ETN-IDENTITY-AUDITORIA-1B-REAL.md`. Nenhuma alteração foi realizada nos repositórios auditados, no banco D1 ou na Cloudflare.
