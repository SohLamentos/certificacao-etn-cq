# ETN CERTIFICAÇÃO CQ — PAGES GATE 2
## ADAPTAÇÃO DO FRONTEND PARA API CLOUDFLARE E AUTH ETN

Data: 2026-09-29  
Ambiente Backend: Cloudflare Worker (`https://etn-certificacao-cq-api.persistentesoficial365.workers.dev`)  
Ambiente Frontend: Cloudflare Pages (`https://etn-certificacao-cq.pages.dev`)  
Status: PASS (100% dos Gates Aprovados)

---

### 1. OBJETIVO EXECUTIVO
Adaptar o frontend React/Vite para operar de forma desacoplada contra a API do Cloudflare Worker e a autoridade central ETN Materiais:
1. Eliminar chamadas relativas dispersas `/api/...` e centralizar em `src/api/client.ts`.
2. Implementar suporte a `VITE_API_BASE_URL` com normalização de trailing slash.
3. Migrar do modelo legado de cookies (`credentials: 'include'`) para o padrão estrito **Bearer Token ETN** no cabeçalho `Authorization`.
4. Armazenar o token em `sessionStorage` para proteção de estações compartilhadas e suporte a F5.
5. Tratar códigos de erro canônicos de forma contextual (401, 403 `APPLICATION_ACCESS_DENIED`, 502 `ETN_AUTH_UNAVAILABLE`).
6. Desativar módulos e endpoints legados que não constam na governança do Worker (`ChangePasswordModal`, endpoints inexistentes no AdminDashboard).

---

### 2. DECISÃO DE SEGURANÇA: ARMAZENAMENTO DO TOKEN
- **Mecanismo Escolhido:** `sessionStorage` (chave `etn_cq_auth_token`).
- **Justificativa Técnica:**
  - **Uso em Campo / Estações Compartilhadas:** Em operações de certificação prática e treinamentos, técnicos, analistas e gestores frequentemente utilizam notebooks e computadores de base compartilhados. O `sessionStorage` garante que o encerramento da aba ou do navegador elimine imediatamente o token, mitigando o risco de sequestro de credenciais.
  - **Resiliência a Recarregamento (F5):** O `sessionStorage` sobrevive a recarregamentos de página (F5) na mesma aba, preservando o fluxo de trabalho contra instabilidades de rede móvel (4G/5G).
  - **Descarte de `localStorage`:** O `localStorage` persiste indefinidamente mesmo após fechar o navegador, o que aumentaria a janela de exposição em dispositivos compartilhados caso o usuário não clique explicitamente em Logout.
  - **Descarte de Memória Pura:** Memória de componente (React State) é perdida a qualquer recarregamento, obrigando reautenticação contínua.

---

### 3. ARQUITETURA IMPLEMENTADA
- **Cliente Centralizado (`src/api/client.ts`):**
  - Normalização da URL base via `getApiBaseUrl()`.
  - Injeção automática de `Authorization: Bearer <token>`.
  - Injeção automática de `Content-Type: application/json` quando aplicável.
  - Fail-closed em erros de rede ou timeouts.
  - Sanitização absoluta: senhas e tokens nunca são registrados em console ou mensagens de erro.
- **Login (`LoginView.tsx`):**
  - Envia apenas `login` e `password`. A senha existe estritamente durante o transporte HTTP.
  - Armazena o token recebido no `sessionStorage`.
  - Apresenta feedback visual distinto para credenciais inválidas (401), serviço indisponível (502) e acesso não concedido (403).
- **Restauração de Sessão (`App.tsx`):**
  - Recupera token do `sessionStorage`.
  - Valida identidade central via `GET /api/auth/me`. Se falhar (401), limpa o token.
  - Valida autorização local via `GET /api/cq/me`. Se receber 403 `APPLICATION_ACCESS_DENIED`, renderiza tela contextual de autorização pendente sem liberar a aplicação.
- **Admin Dashboard (`AdminDashboardView.tsx`):**
  - Chamadas a `/api/admin/dashboard`, `/api/admin/users` e `/api/admin/audit-logs` foram desativadas para não depender de rotas não homologadas.
  - Conectado ao endpoint homologado `GET /api/admin/probe` via `apiClient.adminProbe()`.
  - Inclui teste de verificação de barreira fail-closed (chamada desautenticada rejeitada com 401).

---

### 4. MATRIZ DE TESTES AUTOMATIZADOS (16 CENÁRIOS — 100% PASS)
Suíte `test/frontend-api-client.test.ts`:
1. `API base de produção normaliza trailing slash e respeita fallback`: PASS
2. `Login 200 armazena token no client storage`: PASS
3. `Login 401 não armazena token`: PASS
4. `Login 403 APPLICATION_ACCESS_DENIED preserva rejeição e não abre dashboard`: PASS
5. `Bearer token é enviado automaticamente no cabeçalho Authorization`: PASS
6. `F5 restaura sessão válida via /api/auth/me e /api/cq/me`: PASS
7. `Token inválido no restore é removido e invalida sessão`: PASS
8. `Logout remove token local`: PASS
9. `Logout remoto com falha (ex: 500) ainda limpa token local (fail-safe)`: PASS
10. `/api/cq/me 200 libera aplicação com roles corretas`: PASS
11. `/api/cq/me 403 bloqueia acesso à aplicação (APPLICATION_ACCESS_DENIED)`: PASS
12. `Manipulação de role no browser não concede privilégios (validação no Worker)`: PASS
13. `AdminDashboard não chama endpoints inexistentes do Worker`: PASS
14. `ChangePasswordModal não participa do fluxo de produção no App.tsx`: PASS
15. `Senha nunca persiste no client storage ou em memória permanente`: PASS
16. `Token nunca é concatenado em query string ou URL`: PASS

---

### 5. RELATÓRIO DO GATE

- **API CLIENT CENTRALIZADO:** SIM (`src/api/client.ts`)
- **VITE_API_BASE_URL:** SIM (Documentada em `.env.example`, fallback local suportado)
- **TOKEN STORAGE ESCOLHIDO:** SESSIONSTORAGE
- **JUSTIFICATIVA:** Proteção de estações de campo compartilhadas (limpeza ao fechar aba/navegador), resiliência ao F5 e sem persistência desnecessária no disco.
- **BEARER FLOW:** SIM (`Authorization: Bearer <token>` em 100% das requisições autenticadas)
- **F5:** PASS (Restauração atômica via `authMe` + `cqMe`)
- **LOGOUT:** PASS (Revogação remota + limpeza mandatória local no `finally`)
- **CQ ACCESS 403:** PASS (Bloqueia dashboard e exibe tela informativa `APPLICATION_ACCESS_DENIED`)
- **ADMIN DASHBOARD COMPATÍVEL:** SIM (Usa `/api/admin/probe`; removeu chamadas não homologadas)
- **CHANGE PASSWORD LEGADO INATIVO:** SIM (Removido do `App.tsx`)
- **CORS:** PASS (Worker autoriza `https://etn-certificacao-cq.pages.dev` e `*.pages.dev`)

- **NPM CI:** PASS
- **TYPECHECK:** PASS (`tsc --noEmit` com 0 erros)
- **TESTES:** PASS (60/60 testes passando em 4 suítes)
- **BUILD FRONTEND:** PASS (`vite build` gerou `dist/` em 4.25s)
- **BUILD WORKER:** PASS (`esbuild` gerou `dist/worker.js` de 21.6kb em 8ms)
