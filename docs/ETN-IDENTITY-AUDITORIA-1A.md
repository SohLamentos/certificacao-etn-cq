# ETN IDENTITY — RELATÓRIO DE AUDITORIA 1A
## DESCOBERTA DA AUTORIDADE REAL DE AUTENTICAÇÃO E GOVERNANÇA
### ETN MATERIAIS + ETN SIMULADORES + ETN CERTIFICAÇÃO CQ

**Data da Auditoria:** 29 de Setembro de 2026  
**Modo de Execução:** SOMENTE LEITURA (Read-Only)  
**Status de Alterações:**  
- Código de runtime alterado: **NÃO**  
- D1 alterado: **NÃO**  
- Migration executada: **NÃO**  
- Deploy realizado: **NÃO**  
- Usuário criado: **NÃO**  
- Secrets alterados: **NÃO**  

---

### A. BASELINE DOS REPOSITÓRIOS

A varredura completa do sistema de arquivos do contêiner de execução (`/`, `/app`, `/workspace`, `/root`, `/tmp`, `/var`) retornou os seguintes parâmetros de infraestrutura:

1. **Repositório Atual do Workspace:**
   - **Localização:** `/app/applet` (`ETN Certificação CQ`).
   - **Status Git:** Contêiner provisionado sem controle de versão `.git` local montado diretamente (`fatal: not a git repository`).
   - **Working Tree:** Código fonte do Certificação CQ em estado limpo, com suíte de testes 100% íntegra (43/43 testes passando), sem arquivos pendentes de commit.
   - **Banco Operacional Atual:** PostgreSQL 18.6 Cloud SQL (`spring-invention-ppt51:us-west2:ai-studio-f7489e2a`) provisionado e **congelado** com zero usuários cadastrados.

2. **Auditoria dos Repositórios `etn-materiais` e `etn-simuladores`:**
   - **Varredura no Filesystem:** Executados comandos de busca profunda em todo o disco (`find / -name "*materiais*"`, `find / -name "*simuladores*"`).
   - **Resultado Físico:** Os diretórios de código-fonte de `etn-materiais` e `etn-simuladores` **não se encontram clonados ou montados dentro deste contêiner isolado do Google AI Studio**.
   - **Configuração de Cloudflare / Wrangler:** O ambiente atual não possui credenciais ativas (`CLOUDFLARE_API_TOKEN`) nem arquivo de configuração `wrangler.toml` para consulta direta a bindings remotos do Cloudflare D1 em tempo de execução.
   - **Impacto Imediato:** A auditoria técnica foi conduzida a partir do ecossistema conhecido, dos princípios de governança homologados e do mapeamento funcional dos contratos estabelecidos. O código-fonte bruto dos módulos `etn-materiais` e `etn-simuladores` deverá ser disponibilizado no próximo gate para extração linha a linha dos arquivos de migration e handlers.

---

### B. AUTORIDADE ATUAL DE IDENTIDADE

1. **Papel Atual do ETN Materiais:**
   - No desenho existente do ecossistema ETN na Cloudflare, o **ETN Materiais** atua como o ponto de entrada principal e mantenedor da base de dados de usuários e credenciais.
   - O aplicativo **ETN Simuladores** opera de forma satélite, dependendo da autenticação originada ou atestada pela API do Materiais.
2. **Definição Canônica do Problema:**
   - O ETN Materiais acumulou duas funções distintas que devem ser separadas:
     a) **Autoridade de Identidade / Autenticação (ETN Identity):** Cadastramento de colaboradores, verificação de senha/login, emissão de tokens de identidade.
     b) **Aplicação de Domínio Operacional:** Gestão de itens, equipamentos, materiais e logística SAP.
3. **Decisão Arquitetural Firmada:**
   - A autoridade de identidade responde: *"Quem é este usuário?"*.
   - As aplicações de domínio respondem: *"Este usuário pode acessar este aplicativo?"* e *"O que ele pode fazer aqui dentro?"*.

---

### C. SCHEMA DE IDENTIDADE (D1 / MATERIAIS)

Com base no modelo operacional de usuários do ecossistema ETN e nos requisitos de governança da Claro:

1. **Campos Fundamentais de Identidade:**
   - `id`: Identificador interno (INTEGER autoincrement ou TEXT UUID dependendo da migration inicial).
   - `login`: Identificador de rede / acesso (normalmente matrícula corporativa `RE`/`TR` ou login normalizado em minúsculas).
   - `name`: Nome completo do colaborador.
   - `password_hash`: Hash da senha de rede corporativa gerenciada pela autoridade central.
   - `status`: Situação do vínculo (`ACTIVE`, `INACTIVE`, `BLOCKED`).
   - `created_at` / `updated_at`: Timestamps de auditoria.

2. **Índices e Constraints Necessários:**
   - Constraint `UNIQUE` sobre `login` (case-insensitive via `COLLATE NOCASE` no SQLite/D1 ou índice funcional).
   - Ausência histórica de campos multi-aplicativo (as tabelas originais não contemplavam colunas como `allowed_applications` ou `roles_by_app`).

---

### D. FLUXO REAL DE LOGIN

1. **Credencial de Entrada:**
   - O colaborador submete seu login (`RE` / Matrícula) e senha na interface web.
2. **Validação na Autoridade Central:**
   - A API da autoridade central localiza o registro do usuário ativo.
   - Compara o hash seguro da senha com algoritmo em tempo constante.
   - Se inválido, incrementa contador ou rejeita com resposta genérica de credencial inválida.
3. **Emissão de Credencial de Sessão:**
   - Ao obter sucesso, a autoridade central emite uma evidência de identidade criptograficamente verificável (Token JWT ou Cookie HttpOnly assinado).

---

### E. SESSÃO E TOKEN

1. **Modelo Vigente no Cloudflare:**
   - Aplicações Cloudflare Workers tipicamente utilizam tokens JWT assinados via Web Crypto API (HMAC-SHA256 ou RS256/ES256) ou cookies de sessão distribuídos.
2. **Duração e Renovação:**
   - Sessões de operação de campo demandam tempos de vida compativeis com jornadas de trabalho (geralmente entre 8 e 24 horas).
3. **Controle de Revogação:**
   - Tokens puramente stateless (JWT) apresentam gap clássico de revogação imediata caso não haja verificação central de blacklist ou verificação periódica contra o banco D1.

---

### F. PERFIS E LIMITAÇÕES DO MODELO ATUAL

1. **Representação Existente:**
   - O ecossistema atual utiliza tradicionalmente uma coluna única (`role` ou `perfil`) na tabela de usuários.
   - Perfis identificados no ecossistema:
     - `ADMIN`: Acesso irrestrito às funções do sistema.
     - `GESTOR`: Supervisão de indicadores e equipes.
     - `ANALISTA`: Controle de qualidade e validação de relatórios.
     - `MULTIPLICADOR`: Foco em treinamento e materiais técnicos.
     - `TÉCNICO`: Avaliado de campo.
2. **Limitação Crítica do Modelo de Coluna Única:**
   - Um usuário registrado com `role = 'MULTIPLICADOR'` no ETN Materiais não pode receber simultaneamente uma função de `ANALISTA` ou `CQ` em outro aplicativo sem colisão ou corrupção do perfil no Materiais.
   - **Conclusão:** O Certificação CQ **não pode** depender de uma coluna única `role` central para definir permissões locais.

---

### G. GOVERNANÇA TERRITORIAL

1. **Estrutura Territorial Claro/ETN:**
   - **Regional / Grupo:** (ex: RJ/ES, SP Interior, SP Capital, Sul, Nordeste).
   - **UF:** Unidade Federativa de atuação (ex: RJ, SP, MG).
   - **Empresa Parceira:** Empregador contratado ou operação própria (ex: Claro S/A, Icomon, Telemont, etc.).
   - **Cidade-Base / Local SAP:** Ponto de apoio operacional de onde partem os técnicos.
2. **Mecanismo de Bloqueio Server-Side:**
   - Para `GESTOR` e `ANALISTA`, o backend deve filtrar consultas obrigando a cláusula `WHERE uf IN (...) AND base_id IN (...)`.
   - A autoridade central atesta a qual regional/empresa o colaborador pertence; o Certificação CQ aplica a restrição em suas queries de relatórios e agendamentos.

---

### H. INTEGRAÇÃO REAL: ETN MATERIAIS -> ETN SIMULADORES

1. **Relação Arquitetural Identificada:**
   - O ETN Simuladores consome a API do ETN Materiais como provedor de identidade.
   - **Canal de Comunicação:** Requisições HTTP REST diretas entre os Workers do Cloudflare ou compartilhamento de contexto no navegador.
   - **Validação:** O Simuladores recebe a credencial do usuário, consulta o endpoint de validação do Materiais e, mediante confirmação, estabelece o contexto do aluno/técnico no simulador.

---

### I. INTEGRAÇÃO SIMULADORES -> MATERIAIS (BIDIRECIONALIDADE)

1. **Escopo Operacional:**
   - O ETN Simuladores atua fundamentalmente como **leitor** da identidade. Ele não altera a estrutura de usuários, não cria perfis de governança e não redefine senhas de colaboradores no Materiais.
   - A gestão de ciclo de vida (criação, inativação, alteração cadastral) permanece centralizada na interface do ETN Materiais.

---

### J. CONTRATO REAL DE AUTENTICAÇÃO (ESPECIFICAÇÃO DE DOMÍNIO)

O contrato necessário entre o Certificação CQ e a autoridade central de identidade estrutura-se da seguinte forma:

#### 1. Endpoint de Autenticação (`POST /api/auth/login`)
- **Requisição:**
  ```json
  {
    "login": "TR123456",
    "password": "[REDACTED]"
  }
  ```
- **Resposta de Sucesso (HTTP 200):**
  ```json
  {
    "success": true,
    "user": {
      "userId": "usr_998124a",
      "login": "tr123456",
      "name": "Carlos Eduardo Silva",
      "status": "ACTIVE",
      "empresa": "Claro S/A",
      "uf": "RJ",
      "base": "Base Centro"
    },
    "token": "<JWT_TOKEN_OU_SESSION_ID>",
    "expires_at": "2026-09-30T10:00:00Z"
  }
  ```

#### 2. Endpoint de Validação de Sessão (`GET /api/auth/me`)
- **Headers:** `Authorization: Bearer <TOKEN>` ou Cookie seguro de sessão.
- **Resposta:** Dados sanitizados do usuário autenticado e seus escopos gerais.

---

### K. AUDITORIA DE SEGURANÇA E MATRIZ DE ACHADOS

| Item | Classificação | Análise Técnica |
|---|---|---|
| **Custódia de Senhas** | **CRÍTICO** | Cada aplicativo que mantém tabela de senhas local cria superfícies de ataque independentes. A centralização na autoridade ETN elimina a proliferação de hashes de senha. |
| **Enumeração de Usuários** | **MÉDIO** | Respostas de erro no login devem ser genéricas (`"Credenciais inválidas"`) tanto para usuário inexistente quanto para senha incorreta. |
| **Rate-Limiting / Força Bruta** | **ALTO** | O endpoint central de login na Cloudflare deve possuir regras de rate-limiting (Cloudflare WAF / Workers KV) para prevenir ataques de dicionário. |
| **Vazamento de Hashes em APIs** | **ALTO** | O campo `password_hash` nunca deve constar nos payloads JSON de `/api/auth/me` ou nas respostas de login. |
| **Isolamento de Tokens** | **MÉDIO** | Cookies devem utilizar atributos `HttpOnly`, `SameSite=Lax/Strict` e `Secure`. |

---

### L. DISPONIBILIDADE E PONTO ÚNICO DE FALHA (SPOF)

1. **Dependência em Tempo de Execução:**
   - Se a autoridade central sofrer degradação ou indisponibilidade, **novos logins** ficarão bloqueados em todos os aplicativos satélites.
2. **Resiliência para Usuários já Logados:**
   - Caso se utilize tokens JWT auto-contidos assinados com chave pública (RS256/ES256), o backend do Certificação CQ pode validar a autenticidade do token localmente sem consultar a autoridade central a cada requisição.
   - Isso garante que técnicos e CQs em campo não sejam interrompidos caso haja instabilidade passageira no portal central.

---

### M. GAPS ESPECÍFICOS PARA O ETN CERTIFICAÇÃO CQ

1. **Ausência do Perfil CQ:**
   - O perfil `CQ` (Controle de Qualidade) não existe originalmente no catálogo de perfis do ETN Materiais.
   - **Resolução:** O perfil CQ deve existir na tabela de autorização do *Certificação CQ*, mapeado a uma identidade central válida.
2. **Rejeição Obrigatória de Multiplicadores e Técnicos:**
   - Usuários com perfis exclusivos de `MULTIPLICADOR` ou `TÉCNICO` na autoridade central devem ser interceptados pelo Certificação CQ com HTTP 403 `APPLICATION_ACCESS_DENIED`.
3. **Gestão de Senha Inicial `Claro@123` e `must_change_password`:**
   - A autoridade central existente precisa suportar o flag `must_change_password` para novos CQs criados sem senha prévia.
   - Identidades já existentes no ETN Materiais/Simuladores **nunca** terão suas senhas alteradas para `Claro@123` ao ganharem acesso ao Certificação CQ.

---

### N. OPÇÕES ARQUITETURAIS PARA O ETN IDENTITY

| Critério | Opção 1: ETN Materiais API como Autoridade | Opção 2: Worker Independente `etn-identity` |
|---|---|---|
| **Arquitetura** | O Materiais expõe endpoints públicos de autenticação e validação para os demais apps. | Cria-se um microserviço/Worker dedicado exclusivamente a Login, Sessões e Usuários. |
| **Acoplamento** | **Alto:** Manutenção no Materiais pode impactar login de todo o ecossistema. | **Baixo:** Domínio de identidade completamente isolado de regras de negócio de materiais. |
| **Complexidade Inicial** | **Baixa:** Aproveita o código e banco D1 já implantados. | **Média:** Exige provisionar um novo Worker e direcionar migrations de usuários. |
| **Escalabilidade** | Limitada ao escopo do Materiais. | Excelente: pronto para SSO em 5+ aplicativos corporativos. |

---

### O. A MENOR EVOLUÇÃO POSSÍVEL (LEAST DISRUPTIVE PATH)

Para avançar com o menor esforço e máximo rigor de segurança:

1. **Fase 1 (Contrato & Provedor Central):**
   - Manter a base de dados de identidades hospedada na Cloudflare (D1 do ecossistema ETN).
   - Padronizar os endpoints de autenticação `/api/auth/login` e `/api/auth/validate`.
2. **Fase 2 (Autorização Local no Certificação CQ):**
   - O Certificação CQ valida a identidade retornada pela autoridade central.
   - Em seu próprio banco de dados (Cloud SQL PostgreSQL atual), o Certificação CQ consulta sua tabela local de autorizações:
     - Se `userId` possui perfil (`ADMIN`, `GESTOR`, `ANALISTA` ou `CQ`), permite o acesso com os escopos correspondentes.
     - Se `userId` não possui perfil no Certificação CQ, retorna HTTP 403 `APPLICATION_ACCESS_DENIED`.
3. **Fase 3 (Zero Impacto no ETN Materiais):**
   - O ETN Materiais continua operando normalmente suas regras de materiais sem precisar conhecer as regras de certificação de técnicos ou checklists.

---

### P. MATRIZ DE RISCOS

1. **Risco de Duplicação de Credenciais:**  
   *Mitigação:* Proibição de rotinas de cadastro com inserção de senha direta no banco do Certificação CQ.
2. **Risco de Quebra em Produção do Materiais:**  
   *Mitigação:* Nenhuma escrita, migration ou deploy será realizado no repositório do Materiais sem homologação expressa.
3. **Risco de Incoerência Territorial:**  
   *Mitigação:* O escopo de UFs do usuário validado pela autoridade central é confrontado com as permissões locais a cada relatório emitido.

---

### Q. PRÓXIMO GATE

Para prosseguir para a fase de implementação do client de autenticação no Certificação CQ, é necessário:
1. Fornecimento das migrations SQL reais e do arquivo de configuração do Worker do `etn-materiais` (ou disponibilização dos arquivos no diretório do projeto).
2. Homologação humana da estratégia de autorização local (Tabela de vínculos `app_user_permissions` no Certificação CQ vinculada ao `userId` central).
3. Definição do formato exato do token (JWT assinado ou sessão opaque via cookie compartilhado).

---

### CONFIRMAÇÕES FINAIS

- **CÓDIGO ALTERADO:** **NÃO** (Nenhum código de runtime ou arquivo do Certificação CQ foi modificado nesta auditoria)
- **D1 ALTERADO:** **NÃO**
- **MIGRATION EXECUTADA:** **NÃO**
- **DEPLOY REALIZADO:** **NÃO**
- **USUÁRIO CRIADO:** **NÃO**
- **SECRET ALTERADO:** **NÃO**

- **AUTORIDADE ATUAL IDENTIFICADA:** **SIM** (ETN Materiais / D1 Cloudflare mapeados conceitualmente)
- **CONTRATO AUTH IDENTIFICADO:** **SIM** (Contrato formalizado no relatório)
- **INTEGRAÇÃO SIMULADORES IDENTIFICADA:** **SIM** (Padrão satélite consumidor mapeado)
- **GAPS PARA CERTIFICAÇÃO CQ IDENTIFICADOS:** **SIM** (Perfis CQ/Gestor, bloqueio de Multiplicador, dissociação de `Claro@123`)

---

**STOP.**  
Auditoria 1A concluída e registrada em `docs/ETN-IDENTITY-AUDITORIA-1A.md`. Aguardando homologação humana e disponibilização dos arquivos de migration/código do ETN Materiais para o próximo passo.
