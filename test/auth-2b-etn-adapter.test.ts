import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import { setCustomDbPath, resetDatabase, loadDatabase } from '../src/server/db/store';
import { EtnIdentityProvider, EtnCredentials, EtnAuthResult } from '../src/server/auth/etnIdentityProvider';
import { CQAuthorizationRepository } from '../src/server/auth/cqAuthorizationRepository';
import { createExpressApp } from '../server';

const TEST_DB_PATH = path.resolve(process.cwd(), 'data', 'test_db_auth2b.json');

// Helper to make HTTP requests against express app instance
async function testRequest(
  app: any,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    body?: any;
    headers?: Record<string, string>;
    cookies?: string[];
  }
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders; cookies: string[] }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      if (options.cookies && options.cookies.length > 0) {
        reqHeaders['Cookie'] = options.cookies.join('; ');
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: address.port,
          path: options.path,
          method: options.method,
          headers: reqHeaders,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            server.close();
            let parsedBody: any = rawData;
            try {
              parsedBody = JSON.parse(rawData);
            } catch {
              parsedBody = rawData;
            }
            const setCookie = res.headers['set-cookie'] || [];
            resolve({
              status: res.statusCode || 500,
              body: parsedBody,
              headers: res.headers,
              cookies: Array.isArray(setCookie) ? setCookie : [setCookie],
            });
          });
        }
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  });
}

describe('AUTH-2B: Adaptação para Autenticação ETN Existente (Sem Senha Local)', () => {
  let app: any;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.DB_DRIVER = 'json';
    process.env.NODE_ENV = 'test';
    setCustomDbPath(TEST_DB_PATH);
    resetDatabase();

    // Default mock handler for controlled unit tests
    EtnIdentityProvider.setMockHandler(async (credentials: EtnCredentials): Promise<EtnAuthResult> => {
      const login = (credentials.login || '').trim().toLowerCase();
      const password = credentials.password;

      // Fail if invalid password
      if (password !== 'Correto@ETN2026!') {
        return {
          success: false,
          statusCode: 401,
          error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas ou usuário inativo.' },
        };
      }

      // Return canonical identities based on login
      if (login === 'pedro.cq') {
        return {
          success: true,
          statusCode: 200,
          token: 'etn-token-pedro-cq-12345',
          user: {
            id: 'usr-canonical-pedro-cq',
            login: 'pedro.cq',
            displayName: 'Pedro Henrique CQ',
            role: 'ANALYST',
          },
        };
      }

      if (login === 'admin.central') {
        return {
          success: true,
          statusCode: 200,
          token: 'etn-token-admin-12345',
          user: {
            id: 'usr-canonical-admin-01',
            login: 'admin.central',
            displayName: 'Administrador Central',
            role: 'ADMIN',
          },
        };
      }

      if (login === 'gestor.sp') {
        return {
          success: true,
          statusCode: 200,
          token: 'etn-token-gestor-12345',
          user: {
            id: 'usr-canonical-gestor-sp',
            login: 'gestor.sp',
            displayName: 'Gestor Operacional SP',
            role: 'MANAGER',
          },
        };
      }

      if (login === 'analista.rj') {
        return {
          success: true,
          statusCode: 200,
          token: 'etn-token-analista-12345',
          user: {
            id: 'usr-canonical-analista-rj',
            login: 'analista.rj',
            displayName: 'Analista de Treinamento RJ',
            role: 'ANALYST',
          },
        };
      }

      if (login === 'multiplicador.campo') {
        return {
          success: true,
          statusCode: 200,
          token: 'etn-token-multi-12345',
          user: {
            id: 'usr-canonical-multi-01',
            login: 'multiplicador.campo',
            displayName: 'Multiplicador de Campo',
            role: 'MULTIPLIER',
          },
        };
      }

      if (login === 'tecnico.toa') {
        return {
          success: true,
          statusCode: 200,
          token: 'etn-token-tech-12345',
          user: {
            id: 'usr-canonical-tech-01',
            login: 'tecnico.toa',
            displayName: 'Técnico de Instalação TOA',
            role: 'TECHNICIAN',
          },
        };
      }

      // Default active user
      return {
        success: true,
        statusCode: 200,
        token: `etn-token-${login}-999`,
        user: {
          id: `usr-canonical-${login}`,
          login,
          displayName: `Usuário ${login}`,
          role: 'ANALYST',
        },
      };
    });

    app = await createExpressApp();
  });

  afterEach(() => {
    EtnIdentityProvider.setMockHandler(null);
    process.env = { ...originalEnv };
  });

  it('1. Credencial ETN válida: autentica com sucesso através do provider central', async () => {
    // Configura acesso local para pedro.cq
    await CQAuthorizationRepository.grantAccess('usr-canonical-pedro-cq', ['CQ'], ['SP']);

    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: 'Correto@ETN2026!' },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.user);
    assert.equal(res.body.user.id, 'usr-canonical-pedro-cq');
    assert.equal(res.body.user.login, 'pedro.cq');
    assert.equal(res.body.user.role, 'CQ');
    assert.ok(res.cookies.some((c: string) => c.startsWith('cq_session=')));
  });

  it('2. Credencial ETN inválida: rejeitada com 401 sem revelar detalhes', async () => {
    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: 'SenhaIncorreta!2026' },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Credenciais inválidas ou usuário inativo.');
  });

  it('3. Identidade válida + acesso CQ habilitado: login concluído com sessão gerada', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-pedro-cq', ['CQ'], ['RJ', 'SP']);

    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: 'Correto@ETN2026!' },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user.roles, ['CQ']);
    assert.deepEqual(res.body.user.ufs, ['RJ', 'SP']);
  });

  it('4. Identidade válida + sem acesso CQ: bloqueio com 403 e mensagem canônica', async () => {
    // pedro.cq NÃO possui registro em cq_app_access
    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: 'Correto@ETN2026!' },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'APPLICATION_ACCESS_DENIED');
    assert.equal(res.body.message, 'Seu perfil não possui acesso ao ETN Certificação CQ.');
  });

  it('5. MULTIPLICADOR sem concessão CQ: bloqueado por padrão com 403', async () => {
    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'multiplicador.campo', password: 'Correto@ETN2026!' },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'APPLICATION_ACCESS_DENIED');
  });

  it('6. TÉCNICO sem concessão CQ: bloqueado por padrão com 403', async () => {
    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'tecnico.toa', password: 'Correto@ETN2026!' },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'APPLICATION_ACCESS_DENIED');
  });

  it('7. ADMIN autorizado: autentica e acessa rotas restritas de administração', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-admin-01', ['ADMIN']);

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin.central', password: 'Correto@ETN2026!' },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.role, 'ADMIN');

    const cookie = loginRes.cookies[0];
    const probeRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/probe',
      cookies: [cookie],
    });

    assert.equal(probeRes.status, 200);
    assert.equal(probeRes.body.authorized_role, 'ADMIN');
  });

  it('8. GESTOR autorizado: recebe perfil local GESTOR', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-gestor-sp', ['GESTOR'], ['SP']);

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'gestor.sp', password: 'Correto@ETN2026!' },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.role, 'GESTOR');
    assert.deepEqual(loginRes.body.user.roles, ['GESTOR']);
  });

  it('9. ANALISTA autorizado: recebe perfil local ANALISTA', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-analista-rj', ['ANALISTA'], ['RJ']);

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'analista.rj', password: 'Correto@ETN2026!' },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.role, 'ANALISTA');
  });

  it('10. CQ autorizado: recebe perfil local CQ', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-pedro-cq', ['CQ'], ['MG']);

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: 'Correto@ETN2026!' },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.role, 'CQ');
  });

  it('11. Manipulação de localStorage / cookies falsos não concede acesso', async () => {
    const forgedRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/dashboard',
      headers: {
        'x-client-role': 'ADMIN',
      },
      cookies: ['cq_session=forged-fake-token-attempt'],
    });

    assert.equal(forgedRes.status, 401);
  });

  it('12. Role enviada pelo cliente no body do login é estritamente ignorada', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-pedro-cq', ['CQ']);

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        login: 'pedro.cq',
        password: 'Correto@ETN2026!',
        role: 'ADMIN', // Tentativa maliciosa de escalada
      },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.role, 'CQ'); // Permanece CQ conforme autorização local
  });

  it('13. Falha da autoridade ETN (indisponibilidade): FAIL-CLOSED com HTTP 502', async () => {
    // Simula indisponibilidade de rede ou erro de upstream da autoridade ETN
    EtnIdentityProvider.setMockHandler(async (): Promise<EtnAuthResult> => {
      return {
        success: false,
        statusCode: 502,
        error: {
          code: 'UPSTREAM_GATEWAY_ERROR',
          message: 'Autoridade central de autenticação ETN temporariamente indisponível.',
        },
      };
    });

    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: 'Correto@ETN2026!' },
    });

    assert.equal(res.status, 502);
    assert.ok(res.body.error.includes('indisponível'));
  });

  it('14. Senha NUNCA é persistida no banco local de dados do CQ', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-pedro-cq', ['CQ']);

    const SUBMITTED_PASSWORD = 'Correto@ETN2026!';
    await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: SUBMITTED_PASSWORD },
    });

    const db = loadDatabase();
    const dbDump = JSON.stringify(db);

    // O valor em texto plano da senha não pode existir em nenhum lugar do banco local
    assert.equal(dbDump.includes(SUBMITTED_PASSWORD), false);
  });

  it('15. Senha NUNCA aparece em logs de auditoria ou respostas HTTP', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-pedro-cq', ['CQ']);

    const SECRET_PWD = 'Correto@ETN2026!';
    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: SECRET_PWD },
    });

    // Não aparece na resposta da API
    assert.equal(JSON.stringify(res.body).includes(SECRET_PWD), false);
    assert.equal('password' in res.body.user, false);
    assert.equal('password_hash' in res.body.user, false);

    // Não aparece nos logs de auditoria gravados
    const db = loadDatabase();
    const auditLogsDump = JSON.stringify(db.audit_logs);
    assert.equal(auditLogsDump.includes(SECRET_PWD), false);
  });

  it('16. password_hash local NÃO participa do novo fluxo de autenticação', async () => {
    await CQAuthorizationRepository.grantAccess('usr-canonical-pedro-cq', ['CQ']);

    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'pedro.cq', password: 'Correto@ETN2026!' },
    });

    assert.equal(res.status, 200);

    // Confirma que a tabela de usuários com senhas locais (db.users) permaneceu vazia
    const db = loadDatabase();
    assert.equal(db.users.length, 0);
  });
});
