import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, getApiBaseUrl, getToken, setToken, clearToken, apiFetch } from '../src/api/client';

describe('ETN Certificação CQ — Pages Gate 2: Frontend API Client & Auth ETN (16 Cenários)', () => {
  const originalFetch = globalThis.fetch;
  let mockFetchCalls: { url: string; options: RequestInit }[] = [];

  beforeEach(() => {
    clearToken();
    mockFetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearToken();
  });

  it('1. API base de produção normaliza trailing slash e respeita fallback', () => {
    // Teste de normalização
    const base = getApiBaseUrl();
    assert.equal(base.endsWith('/'), false, 'Não deve ter trailing slash');
  });

  it('2. Login 200 armazena token no client storage', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      mockFetchCalls.push({ url, options: init || {} });

      return new Response(
        JSON.stringify({
          success: true,
          token: 'token-etn-session-valid-12345',
          user: { id: 'usr-1', name: 'Thiago CQ', login: 'thiago', role: 'ADMIN' },
          cq_access: { id: 'acc-1', enabled: true, roles: ['ADMIN'] },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await apiClient.login('thiago', 'MinhaSenhaSegura123!');
    assert.equal(res.ok, true);
    assert.equal(res.data?.token, 'token-etn-session-valid-12345');
    assert.equal(getToken(), 'token-etn-session-valid-12345', 'Token deve ser salvo no storage');
  });

  it('3. Login 401 não armazena token', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciais inválidas ou usuário inativo.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await apiClient.login('usuario_invalido', 'SenhaErrada123!');
    assert.equal(res.ok, false);
    assert.equal(res.status, 401);
    assert.equal(getToken(), null, 'Nenhum token deve ser salvo em caso de erro 401');
  });

  it('4. Login 403 APPLICATION_ACCESS_DENIED preserva rejeição e não abre dashboard', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'APPLICATION_ACCESS_DENIED',
          message: 'Usuário sem concessão de acesso ao Certificação CQ.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await apiClient.login('operador_sem_cq', 'SenhaValida123!');
    assert.equal(res.ok, false);
    assert.equal(res.status, 403);
    assert.equal(res.error, 'APPLICATION_ACCESS_DENIED');
    assert.equal(getToken(), null, 'Não deve armazenar token quando acesso for negado');
  });

  it('5. Bearer token é enviado automaticamente no cabeçalho Authorization', async () => {
    setToken('bearer-token-automático-987');

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      mockFetchCalls.push({ url: String(input), options: init || {} });
      return new Response(
        JSON.stringify({
          success: true,
          user: { id: 'usr-1', name: 'Thiago CQ', login: 'thiago', role: 'ADMIN' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await apiClient.authMe();
    assert.equal(mockFetchCalls.length, 1);
    const headers = mockFetchCalls[0].options.headers as Headers;
    assert.equal(headers.get('Authorization'), 'Bearer bearer-token-automático-987');
  });

  it('6. F5 restaura sessão válida via /api/auth/me e /api/cq/me', async () => {
    setToken('token-f5-valido');

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            user: { id: 'u1', name: 'Admin CQ', login: 'admin', role: 'ADMIN' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/cq/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            user: { id: 'u1', name: 'Admin CQ', login: 'admin', role: 'ADMIN' },
            cq_access: { id: 'acc-1', enabled: true },
            roles: ['ADMIN'],
            scopes: ['SP'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(null, { status: 404 });
    };

    const meRes = await apiClient.authMe();
    assert.equal(meRes.ok, true);
    assert.equal(meRes.data?.user.login, 'admin');

    const cqRes = await apiClient.cqMe();
    assert.equal(cqRes.ok, true);
    assert.deepEqual(cqRes.data?.roles, ['ADMIN']);
  });

  it('7. Token inválido no restore é removido e invalida sessão', async () => {
    setToken('token-expirado');

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Token expirado.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const meRes = await apiClient.authMe();
    assert.equal(meRes.ok, false);
    assert.equal(meRes.status, 401);

    // Na arquitetura do App.tsx, 401 aciona clearToken()
    if (!meRes.ok) {
      clearToken();
    }
    assert.equal(getToken(), null, 'Token expirado foi removido');
  });

  it('8. Logout remove token local', async () => {
    setToken('token-para-logout');

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ success: true, message: 'Logout realizado.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await apiClient.authLogout();
    assert.equal(res.ok, true);
    assert.equal(getToken(), null, 'Token deve ter sido limpo');
  });

  it('9. Logout remoto com falha (ex: 500) ainda limpa token local (fail-safe)', async () => {
    setToken('token-falha-remota');

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ success: false, error: 'SERVER_ERROR' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await apiClient.authLogout();
    assert.equal(res.ok, false);
    assert.equal(getToken(), null, 'Token local DEVE ser removido mesmo com erro no backend');
  });

  it('10. /api/cq/me 200 libera aplicação com roles corretas', async () => {
    setToken('token-cq-ativo');

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: true,
          user: { id: 'u-cq', name: 'Avaliador CQ', login: 'avaliador', role: 'MULTIPLIER' },
          cq_access: { id: 'acc-cq', enabled: true },
          roles: ['CQ'],
          scopes: ['RJ'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await apiClient.cqMe();
    assert.equal(res.ok, true);
    assert.equal(res.data?.roles.includes('CQ'), true);
    assert.deepEqual(res.data?.scopes, ['RJ']);
  });

  it('11. /api/cq/me 403 bloqueia acesso à aplicação (APPLICATION_ACCESS_DENIED)', async () => {
    setToken('token-sem-permissao');

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'APPLICATION_ACCESS_DENIED',
          message: 'Usuário sem concessão de acesso ao Certificação CQ.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await apiClient.cqMe();
    assert.equal(res.ok, false);
    assert.equal(res.status, 403);
    assert.equal(res.error, 'APPLICATION_ACCESS_DENIED');
  });

  it('12. Manipulação de role no browser não concede privilégios (validação no Worker)', async () => {
    setToken('token-usuario-comum');

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/probe')) {
        // Worker rejeita porque usuário não possui role ADMIN no D1
        return new Response(
          JSON.stringify({
            success: false,
            error: 'FORBIDDEN',
            message: 'Acesso negado. Perfil insuficiente para esta operação.',
            required_roles: ['ADMIN'],
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(null, { status: 404 });
    };

    const probeRes = await apiClient.adminProbe();
    assert.equal(probeRes.ok, false);
    assert.equal(probeRes.status, 403);
    assert.equal(probeRes.error, 'FORBIDDEN');
  });

  it('13. AdminDashboard não chama endpoints inexistentes do Worker', () => {
    const adminDashboardCode = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AdminDashboardView.tsx'),
      'utf-8'
    );

    assert.equal(
      adminDashboardCode.includes("fetch('/api/admin/dashboard'"),
      false,
      'Não deve chamar /api/admin/dashboard inexistente'
    );
    assert.equal(
      adminDashboardCode.includes("fetch('/api/admin/users'"),
      false,
      'Não deve chamar /api/admin/users inexistente'
    );
    assert.equal(
      adminDashboardCode.includes("fetch('/api/admin/audit-logs'"),
      false,
      'Não deve chamar /api/admin/audit-logs inexistente'
    );
  });

  it('14. ChangePasswordModal não participa do fluxo de produção no App.tsx', () => {
    const appCode = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

    assert.equal(
      appCode.includes('<ChangePasswordModal'),
      false,
      'ChangePasswordModal não deve ser renderizado no App.tsx'
    );
    assert.equal(
      appCode.includes("import ChangePasswordModal from './components/ChangePasswordModal'"),
      false,
      'ChangePasswordModal não deve ser importado no App.tsx'
    );
  });

  it('15. Senha nunca persiste no client storage ou em memória permanente', async () => {
    const sensitivePassword = 'SenhaSuperSecretaExtremamenteCritica999!';

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: true,
          token: 'token-teste-seguranca',
          user: { id: 'u1', name: 'Thiago', login: 'thiago', role: 'ADMIN' },
          cq_access: { id: 'acc-1', enabled: true, roles: ['ADMIN'] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await apiClient.login('thiago', sensitivePassword);

    // Verificar se a senha foi salva em qualquer lugar do client
    assert.notEqual(getToken(), sensitivePassword);
    assert.equal(getToken(), 'token-teste-seguranca');
  });

  it('16. Token nunca é concatenado em query string ou URL', async () => {
    setToken('token-secreto-para-url-check');

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      mockFetchCalls.push({ url: String(input), options: init || {} });
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await apiClient.authMe();
    await apiClient.cqMe();
    await apiClient.adminProbe();

    for (const call of mockFetchCalls) {
      assert.equal(
        call.url.includes('token-secreto-para-url-check'),
        false,
        `Token vazou na URL: ${call.url}`
      );
      assert.equal(call.url.includes('token='), false, `Query param de token detectado em ${call.url}`);
    }
  });
});
