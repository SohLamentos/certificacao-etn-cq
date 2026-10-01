# ETN CERTIFICAÇÃO CQ — RELATÓRIO TÉCNICO HOTFIX 3.1
## CORREÇÃO DA INJEÇÃO ESTÁTICA DE VITE_API_BASE_URL NO CLIENT BUNDLE

Data: 2026-09-30  
Ambiente: Cloudflare Pages / Workers API  
Status: Aprovado em todos os gates  

---

### 1. Diagnóstico do Incidente (Hotfix 3)
Durante o primeiro acesso ao frontend publicado em `https://etn-certificacao-cq.pages.dev`, o login disparou:
`POST https://etn-certificacao-cq.pages.dev/api/auth/login -> HTTP 405 Method Not Allowed`.

**Causa Raiz Comprovada:**
- O compilador do Vite/Rollup realiza substituição estática de strings (`define`) nas variáveis de ambiente utilizando análise sintática (AST) estrita na sequência de tokens `import.meta.env.VITE_*`.
- Em `src/api/client.ts`, havia sido implementada uma indireção (`const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined; const envUrl = meta?.env?.VITE_API_BASE_URL`).
- Essa indireção impediu o plugin do Vite de reconhecer o token estático no momento do bundling, deixando a variável como `undefined` em runtime de produção e retornando string vazia `""`.
- Como resultado, a requisição foi montada de forma relativa contra a própria origem do Cloudflare Pages (`/api/auth/login`), resultando em HTTP 405.

---

### 2. Implementação Corretiva (Hotfix 3.1)
1. **Acesso Direto à Variável:**
   - Em `src/api/client.ts`, o acesso à URL foi reescrito diretamente para:
     `const rawUrl = import.meta.env.VITE_API_BASE_URL;`
   - Removida qualquer utilização de `process.env` no frontend.
   - Removida qualquer indireção `const meta = ...`.
   - Adicionada tipagem TypeScript de suporte no arquivo `src/vite-env.d.ts` (`/// <reference types="vite/client" />`).
2. **Fail-Closed de Configuração Mandatório:**
   - Caso `VITE_API_BASE_URL` esteja ausente ou vazia em ambiente produtivo, o cliente **NÃO** faz fallback silencioso para `""` ou `"/api"`.
   - Lança explicitamente o erro sanitizado `API_BASE_URL_NOT_CONFIGURED`, impedindo que credenciais sejam enviadas para a origem estática do Pages.
   - O fallback relativo fica restrito unicamente ao ambiente local identificado como `import.meta.env.DEV`.
3. **Regressão Automatizada:**
   - Adicionados testes unitários e de integração cobrindo fail-closed de configuração, formatação exata da URL do Worker e validação de ausência de chamadas contra `pages.dev`.

---

### 3. Evidência Fática de Compilação
- Build executado com:
  `VITE_API_BASE_URL=https://etn-certificacao-cq-api.persistentesoficial365.workers.dev npm run build`
- Inspeção em `dist/assets/*.js`:
  - `URL DO WORKER PRESENTE NO BUNDLE: SIM`
  - Injeção literal no bundle comprovada: `String("https://etn-certificacao-cq-api.persistentesoficial365.workers.dev")`.
  - Nenhuma chamada no fluxo produtivo gera rota relativa para o domínio do Pages.

---

### 4. Invariantes de Segurança
- `wrangler.toml`: NÃO alterado.
- `migrations/0001_cq_authorization.sql`: NÃO alterado.
- `src/worker/*`: NÃO alterado.
- `package-lock.json`: NÃO alterado.
- Usuários, senhas e chaves criptográficas: Intactos.
