import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
import { setCustomDbPath, resetDatabase, loadDatabase } from '../src/server/db/store';
import { runMigrations } from '../src/server/db/migrations';
import { bootstrapAdmin } from '../src/server/auth/bootstrap';
import { UserRepository } from '../src/server/auth/userRepository';
import { hashPassword, verifyPassword } from '../src/server/auth/password';
import { createExpressApp, isDatabaseConfigValid } from '../server';
import http from 'node:http';

const TEST_DB_PATH = path.resolve(process.cwd(), 'data', 'test_db.json');
const TEST_ADMIN_PASSWORD = 'TestAdminSecret!2026';

// Helper to make HTTP requests against express app instance without external server
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

describe('AUTH-1, AUTH-1.1 & AUTH-1.2: Fundação de Autenticação, RBAC, Persistência e Hardening', () => {
  let app: any;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.ADMIN_INITIAL_PASSWORD = TEST_ADMIN_PASSWORD;
    process.env.DB_DRIVER = 'json';
    process.env.NODE_ENV = 'test';
    setCustomDbPath(TEST_DB_PATH);
    resetDatabase();
    await runMigrations();
    app = await createExpressApp();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. bootstrap NÃO cria ADMIN se ADMIN_INITIAL_PASSWORD não estiver configurada e não existir ADMIN', async () => {
    delete process.env.ADMIN_INITIAL_PASSWORD;
    const result = await bootstrapAdmin();
    assert.equal(result.bootstrapped, false);
    assert.equal(result.error, 'MISSING_ADMIN_INITIAL_PASSWORD');
    assert.ok(result.message.includes('não está configurada'));

    const users = await UserRepository.list();
    assert.equal(users.length, 0);
  });

  it('2. bootstrap cria ADMIN quando inexistente se ADMIN_INITIAL_PASSWORD for fornecida', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = TEST_ADMIN_PASSWORD;
    const result = await bootstrapAdmin();
    assert.equal(result.bootstrapped, true);
    assert.ok(result.adminUser);
    assert.equal(result.adminUser.role, 'ADMIN');
    assert.equal(result.adminUser.status, 'ACTIVE');
    assert.equal(result.adminUser.login, 'admin');

    const users = await UserRepository.list();
    assert.equal(users.length, 1);
    assert.equal(users[0].role, 'ADMIN');
  });

  it('3. bootstrap é idempotente', async () => {
    const res1 = await bootstrapAdmin();
    assert.equal(res1.bootstrapped, true);

    const res2 = await bootstrapAdmin();
    assert.equal(res2.bootstrapped, false);

    const users = await UserRepository.list();
    assert.equal(users.length, 1);
  });

  it('4. bootstrap não sobrescreve ADMIN existente e não exige senha se ADMIN já existir', async () => {
    await bootstrapAdmin();
    const admin = await UserRepository.findByLogin('admin');
    assert.ok(admin);
    const originalHash = admin.password_hash;

    delete process.env.ADMIN_INITIAL_PASSWORD;

    const res2 = await bootstrapAdmin();
    assert.equal(res2.bootstrapped, false);
    assert.ok(res2.message.includes('already exists'));

    const adminAfter = await UserRepository.findByLogin('admin');
    assert.equal(adminAfter?.password_hash, originalHash);
  });

  it('5. senha não é armazenada em texto puro', async () => {
    await bootstrapAdmin();
    const admin = await UserRepository.findByLogin('admin');
    assert.ok(admin);
    assert.notEqual(admin.password_hash, TEST_ADMIN_PASSWORD);
    assert.ok(admin.password_hash.startsWith('$2')); // bcrypt prefix
    assert.equal(await verifyPassword(TEST_ADMIN_PASSWORD, admin.password_hash), true);
  });

  it('6. login válido funciona', async () => {
    await bootstrapAdmin();

    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.user);
    assert.equal(res.body.user.login, 'admin');
    assert.equal(res.body.user.role, 'ADMIN');
    assert.ok(res.cookies.some((c: string) => c.startsWith('cq_session=')));
  });

  it('7. senha inválida falha', async () => {
    await bootstrapAdmin();

    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: 'WrongPassword123' },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Usuário ou senha inválidos.');
  });

  it('8. usuário inexistente retorna resposta genérica', async () => {
    await bootstrapAdmin();

    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'nao_existe_usuario', password: 'SomePassword' },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Usuário ou senha inválidos.');
  });

  it('9. resposta não permite enumeração óbvia (mesma mensagem para inexistente e senha incorreta)', async () => {
    await bootstrapAdmin();

    const resNonExistent = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'inexistente', password: 'Password123' },
    });

    const resWrongPass = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: 'PasswordErrada' },
    });

    assert.equal(resNonExistent.status, 401);
    assert.equal(resWrongPass.status, 401);
    assert.equal(resNonExistent.body.error, resWrongPass.body.error);
    assert.equal(resNonExistent.body.error, 'Usuário ou senha inválidos.');
  });

  it('10. sessão é criada no banco com SHA-256 digest e cookie HttpOnly contém raw token', async () => {
    await bootstrapAdmin();

    const res = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    assert.equal(res.status, 200);
    const db = loadDatabase();
    assert.equal(db.sessions.length, 1);
    assert.ok(res.cookies[0].includes('HttpOnly'));

    // Extract raw token from cookie cq_session=<rawToken>; ...
    const cookieHeader = res.cookies[0];
    const match = cookieHeader.match(/cq_session=([^;]+)/);
    assert.ok(match, 'Cookie must contain cq_session token');
    const rawToken = match[1];

    // Security check: The database MUST NOT store the rawToken in plaintext
    const storedSession = db.sessions[0];
    assert.notEqual(storedSession.id, rawToken);

    // The database must store the SHA-256 digest of the raw token
    const expectedDigest = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert.equal(storedSession.id, expectedDigest);
  });

  it('11. /api/auth/me funciona autenticado', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const meRes = await testRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      cookies: [sessionCookie],
    });

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.login, 'admin');
    assert.equal(meRes.body.user.role, 'ADMIN');
  });

  it('12. /api/auth/me rejeita não autenticado', async () => {
    const meRes = await testRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
    });

    assert.equal(meRes.status, 401);
    assert.ok(meRes.body.error.includes('Não autenticado'));
  });

  it('13. logout invalida sessão no backend e limpa cookie', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const logoutRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/logout',
      cookies: [sessionCookie],
    });

    assert.equal(logoutRes.status, 200);

    const db = loadDatabase();
    assert.equal(db.sessions.length, 0);

    const meAfterLogout = await testRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      cookies: [sessionCookie],
    });
    assert.equal(meAfterLogout.status, 401);
  });

  it('14. rota ADMIN rejeita requisição anônima com 401', async () => {
    const adminRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/dashboard',
    });

    assert.equal(adminRes.status, 401);
  });

  it('15. rota ADMIN rejeita usuário autenticado com role diferente com 403', async () => {
    const hash = await hashPassword('Cq@Pass123');
    await UserRepository.create({
      login: 'cq.pedro',
      name: 'Pedro Henrique CQ',
      password_hash: hash,
      role: 'CQ',
      status: 'ACTIVE',
    });

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'cq.pedro', password: 'Cq@Pass123' },
    });

    assert.equal(loginRes.status, 200);
    const sessionCookie = loginRes.cookies[0];

    const adminRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/dashboard',
      cookies: [sessionCookie],
    });

    assert.equal(adminRes.status, 403);
    assert.equal(adminRes.body.error, 'Acesso negado. Permissão insuficiente.');
  });

  it('16. rota ADMIN aceita usuário com role ADMIN', async () => {
    const result = await bootstrapAdmin();
    await UserRepository.update(result.adminUser!.id, { must_change_password: false });

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const adminRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/dashboard',
      cookies: [sessionCookie],
    });

    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.status, 'ONLINE');
    assert.equal(adminRes.body.admin_user, 'admin');
  });

  it('17. usuário INACTIVE não autentica/acessa', async () => {
    const hash = await hashPassword('Pass@123');
    await UserRepository.create({
      login: 'inativo.user',
      name: 'Usuario Inativo',
      password_hash: hash,
      role: 'ADMIN',
      status: 'INACTIVE',
    });

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'inativo.user', password: 'Pass@123' },
    });

    assert.equal(loginRes.status, 403);
    assert.ok(loginRes.body.error.includes('Conta inativa'));
  });

  it('18. usuário BLOCKED não autentica/acessa', async () => {
    const hash = await hashPassword('Pass@123');
    await UserRepository.create({
      login: 'bloqueado.user',
      name: 'Usuario Bloqueado',
      password_hash: hash,
      role: 'ADMIN',
      status: 'BLOCKED',
    });

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'bloqueado.user', password: 'Pass@123' },
    });

    assert.equal(loginRes.status, 403);
    assert.ok(loginRes.body.error.includes('Conta bloqueada'));
  });

  it('19. tentativas inválidas incrementam proteção', async () => {
    await bootstrapAdmin();

    for (let i = 1; i <= 3; i++) {
      const res = await testRequest(app, {
        method: 'POST',
        path: '/api/auth/login',
        body: { login: 'admin', password: 'Errada' },
      });
      assert.equal(res.status, 401);
    }

    const admin = await UserRepository.findByLogin('admin');
    assert.equal(admin?.failed_login_attempts, 3);
    assert.equal(admin?.locked_until, null);
  });

  it('20. bloqueio temporário funciona após atingir limite de tentativas', async () => {
    await bootstrapAdmin();

    for (let i = 1; i <= 5; i++) {
      await testRequest(app, {
        method: 'POST',
        path: '/api/auth/login',
        body: { login: 'admin', password: 'Errada' },
      });
    }

    const admin = await UserRepository.findByLogin('admin');
    assert.equal(admin?.failed_login_attempts, 5);
    assert.ok(admin?.locked_until);

    const lockedRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    assert.equal(lockedRes.status, 423);
    assert.ok(lockedRes.body.error.includes('bloqueada'));
  });

  it('21. login bem-sucedido normaliza estado de tentativas', async () => {
    await bootstrapAdmin();

    await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: 'Errada' },
    });
    await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: 'Errada' },
    });

    let admin = await UserRepository.findByLogin('admin');
    assert.equal(admin?.failed_login_attempts, 2);

    const successRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });
    assert.equal(successRes.status, 200);

    admin = await UserRepository.findByLogin('admin');
    assert.equal(admin?.failed_login_attempts, 0);
    assert.equal(admin?.locked_until, null);
    assert.ok(admin?.last_login_at);
  });

  it('22. password_hash nunca aparece nas respostas da API (mesmo para ADMIN)', async () => {
    const result = await bootstrapAdmin();
    await UserRepository.update(result.adminUser!.id, { must_change_password: false });

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    assert.equal(loginRes.body.user.password_hash, undefined);
    assert.equal('password_hash' in loginRes.body.user, false);

    const sessionCookie = loginRes.cookies[0];

    const meRes = await testRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      cookies: [sessionCookie],
    });
    assert.equal(meRes.body.user.password_hash, undefined);
    assert.equal('password_hash' in meRes.body.user, false);

    const usersRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/users',
      cookies: [sessionCookie],
    });
    for (const u of usersRes.body.users) {
      assert.equal(u.password_hash, undefined);
      assert.equal('password_hash' in u, false);
    }
  });

  it('23. role não pode ser escolhido pelo cliente (vem exclusivamente do banco)', async () => {
    const hash = await hashPassword('Analista@123');
    await UserRepository.create({
      login: 'analista1',
      name: 'Analista Um',
      password_hash: hash,
      role: 'ANALISTA',
      status: 'ACTIVE',
    });

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'analista1', password: 'Analista@123', role: 'ADMIN' },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.role, 'ANALISTA');
  });

  it('24. reload restaura sessão corretamente com /api/auth/me', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const restoreRes = await testRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      cookies: [sessionCookie],
    });

    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.body.user.login, 'admin');
    assert.equal(restoreRes.body.user.role, 'ADMIN');
  });

  it('25. localStorage não consegue falsificar ADMIN (Cenário de Ataque Simples)', async () => {
    const forgedHeaderRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/dashboard',
      headers: {
        'x-client-role': 'ADMIN',
      },
      cookies: ['cq_session=forged-fake-session-token'],
    });

    assert.equal(forgedHeaderRes.status, 401);
  });

  it('26. FAIL-CLOSED: Em produção, DB_DRIVER diferente de postgres é rejeitado', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_DRIVER = 'json';

    const check = isDatabaseConfigValid();
    assert.equal(check.valid, false);
    assert.ok(check.reason?.includes('FATAL SECURITY CONFIGURATION ERROR'));
  });

  it('27. Health check endpoint responde 200 sem vazar dados sensíveis', async () => {
    const healthRes = await testRequest(app, {
      method: 'GET',
      path: '/api/health',
    });

    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.status, 'HEALTHY');
    assert.equal(healthRes.body.database, 'CONNECTED');
    assert.equal(typeof healthRes.body.timestamp, 'string');
    assert.equal(healthRes.body.host, undefined);
    assert.equal(healthRes.body.password, undefined);
    assert.equal(healthRes.body.user, undefined);
  });

  it('28. Bootstrap rejeita senha inicial fraca ou proibida', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'Claro@123';
    const result = await bootstrapAdmin();
    assert.equal(result.bootstrapped, false);
    assert.equal(result.error, 'WEAK_ADMIN_INITIAL_PASSWORD');

    const users = await UserRepository.list();
    assert.equal(users.length, 0);
  });

  it('29. Usuário com must_change_password=true é bloqueado em rota ADMIN com 403', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const adminRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/dashboard',
      cookies: [sessionCookie],
    });

    assert.equal(adminRes.status, 403);
    assert.equal(adminRes.body.error, 'PASSWORD_CHANGE_REQUIRED');
  });

  it('30. /api/auth/me continua acessível mesmo com must_change_password=true', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const meRes = await testRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      cookies: [sessionCookie],
    });

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.must_change_password, true);
  });

  it('31. change-password exige senha atual válida', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const changeRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/change-password',
      cookies: [sessionCookie],
      body: {
        current_password: 'SenhaErrada!2026',
        new_password: 'NovaSenhaForte!2026',
      },
    });

    assert.equal(changeRes.status, 400);
    assert.equal(changeRes.body.error, 'Senha atual incorreta.');
  });

  it('32. change-password rejeita nova senha fraca ou trivial', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const changeRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/change-password',
      cookies: [sessionCookie],
      body: {
        current_password: TEST_ADMIN_PASSWORD,
        new_password: 'admin',
      },
    });

    assert.equal(changeRes.status, 400);
    assert.ok(changeRes.body.error.includes('mínimo 8 caracteres'));
  });

  it('33. change-password impede reutilização da mesma senha atual', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];

    const changeRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/change-password',
      cookies: [sessionCookie],
      body: {
        current_password: TEST_ADMIN_PASSWORD,
        new_password: TEST_ADMIN_PASSWORD,
      },
    });

    assert.equal(changeRes.status, 400);
    assert.equal(changeRes.body.error, 'A nova senha deve ser diferente da senha atual.');
  });

  it('34. change-password com sucesso atualiza bcrypt, must_change_password=false e password_changed_at', async () => {
    await bootstrapAdmin();

    const loginRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { login: 'admin', password: TEST_ADMIN_PASSWORD },
    });

    const sessionCookie = loginRes.cookies[0];
    const NEW_SECRET = 'SuperSegura!Nova2026';

    const changeRes = await testRequest(app, {
      method: 'POST',
      path: '/api/auth/change-password',
      cookies: [sessionCookie],
      body: {
        current_password: TEST_ADMIN_PASSWORD,
        new_password: NEW_SECRET,
      },
    });

    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.body.user.must_change_password, false);
    assert.equal('password_hash' in changeRes.body.user, false);

    const admin = await UserRepository.findByLogin('admin');
    assert.equal(admin?.must_change_password, false);
    assert.ok(admin?.password_changed_at);
    assert.equal(await verifyPassword(NEW_SECRET, admin!.password_hash), true);

    // Rotated session cookie can now access ADMIN dashboard
    const rotatedCookie = changeRes.cookies[0];
    const adminRes = await testRequest(app, {
      method: 'GET',
      path: '/api/admin/dashboard',
      cookies: [rotatedCookie],
    });

    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.status, 'ONLINE');
  });
});
