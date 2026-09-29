# ETN CERTIFICAÇÃO CQ — AUTH-2B
## ADAPTAÇÃO PARA AUTENTICAÇÃO ETN EXISTENTE (SEM SENHA LOCAL)

**Data de Implementação:** 29 de Setembro de 2026  
**Status do Gate:** CONCLUÍDO COM SUCESSO (TESTES 16/16 PASS)  
**Natureza da Alteração:** Exclusiva no repositório do ETN Certificação CQ (Zero alterações em Materiais, Simuladores ou Cloudflare).  

---

### A. ARQUITETURA DE AUTH ADAPTADA

A arquitetura do **ETN Certificação CQ** foi desacoplada com sucesso do modelo isolado de senhas locais (AUTH-1) e adaptada para operar como sistema satélite federado à autoridade central de identidade do ecossistema ETN.

```
+───────────────────────────────────────────────────────────────────────────────────+
|                                ARQUITETURA AUTH-2B                                 |
+───────────────────────────────────────────────────────────────────────────────────+

  [ NAVEGADOR / CLIENTE ]
            │
            │  1. POST /api/auth/login { login, password }
            ▼
  [ ETN CERTIFICAÇÃO CQ — BACKEND ]
            │
            │  2. EtnIdentityProvider.login({ login, password })
            │     (Contrato comprovado: POST /api/auth/login)
            ▼
  [ AUTORIDADE CENTRAL: ETN MATERIAIS API ] ───► [ D1: etn-materiais-db-prod ]
            │                                    - users (login, password_hash PBKDF2)
            │                                    - sessions (token_hash SHA-256)
            │  3. Retorna { token, user: { id: "usr_uuid", login, role, ... } }
            ▼
  [ ETN CERTIFICAÇÃO CQ — BACKEND ]
            │
            │  4. Consulta Autorização Local:
            │     CQAuthorizationRepository.getAccessByEtnUserId("usr_uuid")
            │     - cq_app_access (enabled)
            │     - cq_app_roles (ADMIN | GESTOR | ANALISTA | CQ + UFs)
            │
            ├── SE NÃO HABILITADO / SEM ROLES (ou MULTIPLICADOR/TÉCNICO sem concessão):
            │     └── Retorna HTTP 403 { error: "APPLICATION_ACCESS_DENIED" }
            │
            └── SE HABILITADO:
                  └── 5. Emite Sessão Local CQ (Digest SHA-256 no banco, Cookie HttpOnly)
                         Retorna HTTP 200 { user: { id, login, role, roles, ufs } }
```

**Princípio de Separação de Responsabilidades:**
- **Autenticação (Quem é você):** `etn-materiais-api` (Cloudflare Worker central + D1).
- **Autorização (O que você pode fazer no CQ):** `ETN Certificação CQ` (`cq_app_access` + `cq_app_roles`).
- **Dados Operacionais:** `ETN Certificação CQ` (Avaliações de CQ, itens de checklist, relatórios).

---

### B. ETN IDENTITY PROVIDER

- **Arquivo:** `src/server/auth/etnIdentityProvider.ts`
- **Responsabilidade:** Único ponto de contato com a autoridade de identidade central. O restante da aplicação desconhece detalhes de rede, URLs e endpoints do Materiais.
- **Métodos Implementados:**
  1. `login(credentials: EtnCredentials): Promise<EtnAuthResult>`:
     - Normaliza o login (`toLowerCase().trim()`).
     - Submete `POST /api/auth/login` com `{ login, password }`.
     - Nunca armazena, nunca persiste e nunca loga a senha.
     - Suporta Provider Mock controlado em memória para testes unitários automatizados (`setMockHandler`).
     - Suporta Service Binding `MAT_API` nativo quando executado dentro de Cloudflare Worker (`(globalThis as any).MAT_API.fetch`).
     - Suporta chamada HTTPS direta para `ETN_MATERIAIS_AUTH_URL` em ambiente Node.js / Cloud Run.
  2. `validateIdentity(token: string): Promise<EtnIdentityUser | null>`:
     - Consulta `GET /api/auth/me` enviando `Authorization: Bearer <token>`.
  3. `logout(token: string): Promise<void>`:
     - Encaminha revogação remota via `POST /api/auth/logout`.

---

### C. LOGIN FLOW

1. **Submissão do Formulário:**
   - O usuário informa suas credenciais corporativas normais em `src/components/LoginView.tsx`.
   - O browser submete `POST /api/auth/login` ao backend do Certificação CQ.
2. **Encaminhamento para a Autoridade Central:**
   - O backend chama `EtnIdentityProvider.login({ login, password })`.
   - Em caso de credencial inválida, o Materiais retorna `HTTP 401 INVALID_CREDENTIALS`, repassado como `HTTP 401` com mensagem genérica anti-enumeração.
   - Em caso de falha de conexão com a autoridade central, o backend falha fechado (**FAIL-CLOSED**) com `HTTP 502 UPSTREAM_GATEWAY_ERROR`.
3. **Resolução de Autorização Local:**
   - Com o `user.id` canônico retornado pela autoridade, o backend consulta `CQAuthorizationRepository.getAccessByEtnUserId(user.id)`.
   - Se o usuário não possuir registro habilitado em `cq_app_access` ou não tiver papéis atribuídos:
     - Retorna **HTTP 403 APPLICATION_ACCESS_DENIED** (*"Seu perfil não possui acesso ao ETN Certificação CQ."*).
     - Nenhum dado operacional ou dashboard vazio é renderizado.

---

### D. TOKEN FLOW

1. **No Navegador:**
   - A sessão é mantida por meio de cookie seguro **HttpOnly** `cq_session` (`SameSite: Lax`, `Path: /`, expiração de 24 horas).
   - O token bruto nunca é exposto no `localStorage`, mitigando riscos de roubo por scripts maliciosos (XSS).
2. **No Backend do Certificação CQ:**
   - A cada requisição, o middleware `requireAuth` (`src/server/auth/middleware.ts`) extrai o token do cookie (ou header `Authorization: Bearer`).
   - O banco de dados do CQ calcula o hash **SHA-256** do token recebido e busca a sessão na tabela `sessions` (onde apenas o digest reside).
   - Verifica a vigência da autorização local do usuário em `cq_app_access`.
3. **No Logout:**
   - O endpoint `POST /api/auth/logout` remove a sessão local no CQ, invoca a revogação central no Materiais via `EtnIdentityProvider.logout` e limpa o cookie no navegador.

---

### E. AUTORIZAÇÃO LOCAL DO CQ

A autorização local é modelada independentemente do banco de senhas através de duas entidades relacionais:

1. **`cq_app_access`:**
   - `id`: Identificador interno do registro de acesso (UUID).
   - `etn_user_id`: Identificador canônico do colaborador na autoridade central (UUID string).
   - `enabled`: Flag booleana de ativação (permite suspender temporariamente o acesso do colaborador ao CQ sem apagar seus papéis).
   - `created_at`, `updated_at`: Timestamps de auditoria.

2. **`cq_app_roles`:**
   - `id`: UUID.
   - `access_id`: Chave estrangeira referenciando `cq_app_access(id)`.
   - `role`: Papel atribuído (`ADMIN`, `GESTOR`, `ANALISTA`, `CQ`).
   - `ufs`: Lista de UFs sob escopo operacional do colaborador quando restrito territorialmente.
   - `created_at`: Timestamp.

---

### F. SUPORTE A MÚLTIPLAS ROLES E CAPABILITIES

- Diferente do schema legado que limitava o usuário a uma única role textual, o modelo AUTH-2B suporta acumulação de papéis por identidade.
- Uma mesma identidade física pode possuir simultaneamente, por exemplo:
  - Role `ANALISTA` (para visualização de métricas e relatórios).
  - Role `CQ` (para execução de certificações práticas em campo).
- No middleware `requireRole(...allowedRoles)`:
  - O acesso é concedido se o usuário possuir **qualquer** um dos papéis requeridos pelo endpoint.

---

### G. ESCOPO TERRITORIAL

- O campo `ufs` na tabela `cq_app_roles` permite restringir avaliadores de CQ, analistas ou gestores a estados federados específicos (ex: `['SP', 'RJ']`).
- Administradores (`ADMIN`) possuem escopo global irrestrito por definição.

---

### H. COMPONENTES AUTH-1 DESATIVADOS DA ARQUITETURA ATIVA

Os seguintes componentes do antigo sistema local de senhas foram **desacoplados e desativados da arquitetura ativa**, permanecendo apenas como código inerte para evitar quebras destrutivas:

1. **`users.password_hash`:** Desativado. Nenhuma senha ou hash é gravado no banco CQ.
2. **`bcryptjs`:** Desativado do fluxo ativo de login e cadastro.
3. **`bootstrapAdmin` (`src/server/auth/bootstrap.ts`):** Desativado. A função retorna `{ bootstrapped: false, message: 'Local password bootstrap is deactivated under AUTH-2B ETN Identity Federation.' }`.
4. **Variáveis de Ambiente Inativadas:**
   - `ADMIN_INITIAL_PASSWORD`: Não mais utilizada para criar usuários locais.
   - `INITIAL_ADMIN_LOGIN`: Não mais utilizada.
   - `INITIAL_ADMIN_NAME`: Não mais utilizada.
5. **Endpoint `/api/auth/change-password`:** Desativado para senhas locais; retorna erro `400` instruindo o usuário a alterar sua credencial no portal central do ETN Materiais.
6. **`failed_login_attempts` local:** Desativado. O controle de força bruta e bloqueio de tentativas é exercido centralmente pelo Materiais.

---

### I. POSTGRESQL (CLOUD SQL) — DESTINO DOS COMPONENTES

Avaliação do esquema existente no Cloud SQL PostgreSQL:

| Tabela / Migration | Classificação | Destino e Ação Recomendada |
|---|---|---|
| `schema_migrations` (001) | **MANTER** | Mantida para controle de versionamento idempotente das migrations do banco. |
| `users` (002) | **OBSOLETO** | **Não dropar nesta etapa**. Fica inativa. Nenhuma credencial ou novo usuário será inserido nesta tabela. |
| `sessions` (003) | **ADAPTAR** | **Adaptada na Migration 005**. A foreign key restritiva para `users(id)` foi removida (`DROP CONSTRAINT sessions_user_id_fkey`) e a coluna `user_id` foi ajustada para aceitar o `etn_user_id` canônico (UUID/VARCHAR). |
| `audit_logs` (004) | **MANTER** | Mantida para rastreamento forense de acessos, logouts e concessões no Certificação CQ. |
| `cq_app_access` e `cq_app_roles` (005) | **NOVO / MANTER** | Criadas na migration `005_create_cq_authorization_tables` para governança local de identidade do CQ. |

---

### J. CLOUDFLARE TARGET (ARQUITETURA FUTURA)

A arquitetura do backend está preparada com abstrações prontas para a migração para a Cloudflare:
- **`etn-certificacao-cq-api` (Cloudflare Worker):**
  - Consumirá o binding `MAT_API` via `env.MAT_API.fetch('https://etn-materiais-api/api/auth/login')`.
- **D1 Próprio do Certificação CQ (`etn-cq-db`):**
  - Poderá hospedar `cq_app_access`, `cq_app_roles`, `sessions`, `evaluations` e checklists com latência zero.
- **Classificação atual do Service Binding em produção:** **`CODE READY`** *(Aguardando criação da infraestrutura Cloudflare correspondente)*.

---

### K. SUÍTE DE TESTES (AUTH-2B)

Arquivo de testes: **`test/auth-2b-etn-adapter.test.ts`**  
Execução: **`16 testes executados, 16 aprovados (100% PASS)`** em ~190ms.

1. **Credencial ETN válida:** Autentica com sucesso através do provider central. *(PASS)*
2. **Credencial ETN inválida:** Rejeitada com 401 sem revelar detalhes. *(PASS)*
3. **Identidade válida + acesso CQ habilitado:** Login concluído com sessão e papéis gerados. *(PASS)*
4. **Identidade válida + sem acesso CQ:** Bloqueio com HTTP 403 e mensagem canônica. *(PASS)*
5. **MULTIPLICADOR sem concessão CQ:** Bloqueado por padrão com 403. *(PASS)*
6. **TÉCNICO sem concessão CQ:** Bloqueado por padrão com 403. *(PASS)*
7. **ADMIN autorizado:** Autentica e acessa rotas restritas de administração. *(PASS)*
8. **GESTOR autorizado:** Recebe perfil local GESTOR. *(PASS)*
9. **ANALISTA autorizado:** Recebe perfil local ANALISTA. *(PASS)*
10. **CQ autorizado:** Recebe perfil local CQ. *(PASS)*
11. **Manipulação de localStorage / cookies falsos:** Rejeitada com 401 (não concede acesso). *(PASS)*
12. **Role enviada pelo cliente no body:** Estritamente ignorada; prevalece a tabela local. *(PASS)*
13. **Falha da autoridade ETN (indisponibilidade):** FAIL-CLOSED com HTTP 502. *(PASS)*
14. **Senha NUNCA persiste:** Verificação física no dump do banco local (ausência total de credenciais). *(PASS)*
15. **Senha NUNCA aparece em logs:** Ausência de senhas em logs de auditoria e payloads HTTP. *(PASS)*
16. **password_hash local NÃO participa:** Confirma que a tabela local de senhas permaneceu com 0 registros. *(PASS)*

---

### L. GATES DE QUALIDADE

- **Typecheck (`npm run lint` / `tsc --noEmit`):** **PASS** (Zero erros de tipagem).
- **Unit Tests (`npm test`):** **PASS** (16/16 cenários aprovados).
- **Build (`npm run build`):** **PASS** (Compilação Vite SPA concluída com sucesso).

---

### M. PRÓXIMO PASSO

1. Homologação da etapa AUTH-2B.
2. Definição do provisionamento inicial de acessos em `cq_app_access` / `cq_app_roles` para os operadores de teste (ex: `admin`, avaliadores CQ piloto).
3. Preparação das rotas de gestão administrativa de avaliadores CQ.
