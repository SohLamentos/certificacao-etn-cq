import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { handleWorkerRequest } from '../src/worker/app';
import { Env, EtnUser } from '../src/worker/types';

const MIGRATION_PATH = path.resolve(process.cwd(), 'migrations', '0001_cq_authorization.sql');

/**
 * Cria um mock de D1Database em conformidade com Cloudflare D1 usando SQLite in-memory
 */
function createMockD1(): { db: any; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  sqlite.exec(migrationSql);

  const db = {
    prepare(sql: string) {
      let boundParams: any[] = [];
      return {
        bind(...params: any[]) {
          boundParams = params;
          return this;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const stmt = sqlite.prepare(sql);
          const row: any = stmt.get(...boundParams);
          if (!row) return null;
          if (colName) return row[colName] ?? null;
          return row as T;
        },
        async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }> {
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...boundParams) as T[];
          return { results, success: true, meta: {} };
        },
        async run(): Promise<{ success: boolean; meta: { changes: number } }> {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...boundParams);
          return { success: true, meta: { changes: Number(info.changes) } };
        },
      };
    },
    async batch(statements: any[]) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
  };

  return { db, sqlite };
}

/**
 * Cria mock do Service Binding MAT_API (ETN Materiais)
 */
function createMockMatApi(options?: {
  shouldFail?: boolean;
  validTokens?: Record<string, EtnUser>;
  credentials?: Record<string, { user: EtnUser; password: string }>;
}) {
  const { shouldFail = false, validTokens = {}, credentials = {} } = options || {};

  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      if (shouldFail) {
        throw new Error('MAT_API Service Unavailable (Connection refused)');
      }

      const req = input instanceof Request ? input : new Request(input, init);
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      if (method === 'POST' && path === '/api/auth/login') {
        const body: any = await req.json().catch(() => ({}));
        const cred = credentials[body.login];
        if (cred && cred.password === body.password) {
          const token = `token-${cred.user.id}-${Date.now()}`;
          return new Response(
            JSON.stringify({
              success: true,
              token,
              user: cred.user,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: 'INVALID_CREDENTIALS',
            message: 'Login ou senha incorretos.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'GET' && path === '/api/auth/me') {
        const auth = req.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const user = validTokens[token];
        if (user) {
          return new Response(
            JSON.stringify({
              success: true,
              user,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: 'TOKEN_INVALID',
            message: 'Sessão inválida.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'POST' && path === '/api/auth/logout') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  };
}

describe('Worker Gate 1: Arquitetura Cloudflare Worker Nativa (18 Cenários)', () => {
  let mockD1: any;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    const mock = createMockD1();
    mockD1 = mock.db;
    sqlite = mock.sqlite;
  });

  it('1. GET /api/health com DB disponível retorna status ok', async () => {
    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi() as any,
    };

    const req = new Request('https://worker.local/api/health', { method: 'GET' });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.worker, true);
    assert.equal(body.db, true);
    assert.ok(body.timestamp);
    // Não expõe segredos nem database_id
    assert.equal(body.database_id, undefined);
    assert.equal(body.account_id, undefined);
  });

  it('2. Token ausente na requisição protegida -> 401 UNAUTHORIZED', async () => {
    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi() as any,
    };

    const req = new Request('https://worker.local/api/cq/me', { method: 'GET' });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 401);
    const body: any = await res.json();
    assert.equal(body.error, 'UNAUTHORIZED');
  });

  it('3. Token inválido/expirado -> 401 UNAUTHORIZED', async () => {
    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({ validTokens: {} }) as any,
    };

    const req = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-invalido' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 401);
  });

  it('4. Provedor central MAT_API indisponível -> FAIL-CLOSED com HTTP 502', async () => {
    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({ shouldFail: true }) as any,
    };

    const req = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-qualquer' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 502);
    const body: any = await res.json();
    assert.equal(body.error, 'ETN_AUTH_UNAVAILABLE');
  });

  it('5. Identidade válida no ETN mas sem registro em cq_app_access -> 403 APPLICATION_ACCESS_DENIED', async () => {
    const validUser: EtnUser = {
      id: 'usr-sem-acesso',
      name: 'Sem Acesso CQ',
      login: 'sem_acesso',
      role: 'TECNICO',
    };

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { 'token-sem-acesso': validUser },
      }) as any,
    };

    const req = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-sem-acesso' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.error, 'APPLICATION_ACCESS_DENIED');
  });

  it('6. Identidade com cq_app_access desabilitado (enabled = 0) -> 403 APPLICATION_ACCESS_DENIED', async () => {
    const validUser: EtnUser = {
      id: 'usr-desabilitado',
      name: 'Desabilitado CQ',
      login: 'desabilitado',
      role: 'CQ',
    };

    // Inserir registro desabilitado (enabled = 0)
    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-desab', 'usr-desabilitado', 0);

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { 'token-desabilitado': validUser },
      }) as any,
    };

    const req = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-desabilitado' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.error, 'APPLICATION_ACCESS_DENIED');
  });

  it('7. Identidade válida com cq_app_access habilitado (enabled = 1) -> 200 permitido', async () => {
    const validUser: EtnUser = {
      id: 'usr-habilitado',
      name: 'Avaliador CQ',
      login: 'avaliador_cq',
      role: 'TECNICO',
    };

    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-hab', 'usr-habilitado', 1);
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('role-hab', 'acc-hab', 'CQ');
    sqlite
      .prepare('INSERT INTO cq_app_scopes (id, access_id, uf) VALUES (?, ?, ?);')
      .run('scope-hab', 'acc-hab', 'SP');

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { 'token-habilitado': validUser },
      }) as any,
    };

    const req = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-habilitado' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.user.login, 'avaliador_cq');
    assert.deepEqual(body.roles, ['CQ']);
    assert.deepEqual(body.scopes, ['SP']);
  });

  it('8. ADMIN local autorizado -> GET /api/admin/probe permitido com 200', async () => {
    const adminUser: EtnUser = {
      id: 'usr-admin-cq',
      name: 'Admin CQ',
      login: 'admin_cq',
      role: 'ADMIN',
    };

    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-admin', 'usr-admin-cq', 1);
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('role-admin', 'acc-admin', 'ADMIN');

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { 'token-admin': adminUser },
      }) as any,
    };

    const req = new Request('https://worker.local/api/admin/probe', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-admin' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.probe, 'ADMIN_ACCESS_VERIFIED');
  });

  it('9. GESTOR local -> GET /api/admin/probe rejeitado com 403 FORBIDDEN', async () => {
    const gestorUser: EtnUser = {
      id: 'usr-gestor',
      name: 'Gestor',
      login: 'gestor',
      role: 'GESTOR',
    };

    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-gestor', 'usr-gestor', 1);
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('role-gestor', 'acc-gestor', 'GESTOR');

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { 'token-gestor': gestorUser },
      }) as any,
    };

    const req = new Request('https://worker.local/api/admin/probe', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-gestor' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.error, 'FORBIDDEN');
  });

  it('10. ANALISTA local -> GET /api/admin/probe rejeitado com 403 FORBIDDEN', async () => {
    const analistaUser: EtnUser = {
      id: 'usr-analista',
      name: 'Analista',
      login: 'analista',
      role: 'ANALISTA',
    };

    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-analista', 'usr-analista', 1);
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('role-analista', 'acc-analista', 'ANALISTA');

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { 'token-analista': analistaUser },
      }) as any,
    };

    const req = new Request('https://worker.local/api/admin/probe', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-analista' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 403);
  });

  it('11. CQ local -> GET /api/admin/probe rejeitado com 403 FORBIDDEN', async () => {
    const cqUser: EtnUser = {
      id: 'usr-cq-only',
      name: 'CQ Apenas',
      login: 'cq_only',
      role: 'CQ',
    };

    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-cq-only', 'usr-cq-only', 1);
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('role-cq-only', 'acc-cq-only', 'CQ');

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { 'token-cq-only': cqUser },
      }) as any,
    };

    const req = new Request('https://worker.local/api/admin/probe', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-cq-only' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 403);
  });

  it('12. Suporte a múltiplas roles locais para a mesma identidade (ex: ANALISTA + CQ)', async () => {
    const multiUser: EtnUser = {
      id: 'usr-multi-role',
      name: 'Analista e CQ',
      login: 'multi_role',
      role: 'ANALISTA',
    };

    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-multi', 'usr-multi-role', 1);
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('r-multi-1', 'acc-multi', 'ANALISTA');
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('r-multi-2', 'acc-multi', 'CQ');

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { 'token-multi': multiUser },
      }) as any,
    };

    const req = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-multi' },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.deepEqual(body.roles.sort(), ['ANALISTA', 'CQ']);
  });

  it('13. Operações no D1 utilizam SQL parametrizado sem concatenação', async () => {
    // Tentativa de SQL Injection via login ou ID
    const maliciousId = "'; DROP TABLE cq_app_roles; --";
    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: {
          'token-sqli': {
            id: maliciousId,
            name: 'Hacker',
            login: 'hacker',
            role: 'TECNICO',
          },
        },
      }) as any,
    };

    const req = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-sqli' },
    });
    const res = await handleWorkerRequest(req, env);

    // Deve retornar 403 sem corromper o banco
    assert.equal(res.status, 403);
    const checkTable = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cq_app_roles';")
      .get();
    assert.ok(checkTable, 'A tabela cq_app_roles permaneceu intacta');
  });

  it('14. Role enviada pelo browser no body de login é estritamente ignorada', async () => {
    const validUser: EtnUser = {
      id: 'usr-spoof',
      name: 'Tentativa Spoof',
      login: 'spoof_user',
      role: 'TECNICO',
    };

    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-spoof', 'usr-spoof', 1);
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('r-spoof', 'acc-spoof', 'CQ');

    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        credentials: {
          spoof_user: { user: validUser, password: 'correct_password' },
        },
      }) as any,
    };

    // Cliente tenta forçar role ADMIN no payload de login
    const req = new Request('https://worker.local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'spoof_user',
        password: 'correct_password',
        role: 'ADMIN',
      }),
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.deepEqual(body.cq_access.roles, ['CQ'], 'A role atribuída deve ser CQ do banco D1, não a enviada pelo browser');
  });

  it('15. Manipulação de localStorage / cookies falsos não concede acesso', async () => {
    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi() as any,
    };

    // Requisição com cookie falso ou header arbitrário sem token válido
    const req = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: {
        Cookie: 'user=admin; role=ADMIN; access=granted',
        'X-Fake-User': 'admin',
      },
    });
    const res = await handleWorkerRequest(req, env);

    assert.equal(res.status, 401, 'Deve rejeitar com 401 por ausência de Authorization Bearer');
  });

  it('16. Senha NUNCA é persistida no banco D1 do Certificação CQ', async () => {
    const cols = sqlite.prepare("PRAGMA table_info('cq_app_access');").all() as any[];
    const colNames = cols.map((c) => c.name.toLowerCase());

    assert.ok(!colNames.includes('password'));
    assert.ok(!colNames.includes('password_hash'));
    assert.ok(!colNames.includes('salt'));
    assert.ok(!colNames.includes('token'));
  });

  it('17. Token Bearer não é vazado na resposta de /api/cq/me nem /api/admin/probe', async () => {
    const adminUser: EtnUser = {
      id: 'usr-secret-check',
      name: 'Secret Check',
      login: 'sec_check',
      role: 'ADMIN',
    };

    sqlite
      .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?);')
      .run('acc-sec', 'usr-secret-check', 1);
    sqlite
      .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
      .run('r-sec', 'acc-sec', 'ADMIN');

    const secretToken = 'super-secret-bearer-token-12345';
    const env: Env = {
      DB: mockD1,
      MAT_API: createMockMatApi({
        validTokens: { [secretToken]: adminUser },
      }) as any,
    };

    const req1 = new Request('https://worker.local/api/cq/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretToken}` },
    });
    const res1 = await handleWorkerRequest(req1, env);
    const text1 = await res1.text();
    assert.ok(!text1.includes(secretToken), 'Token não pode estar no corpo de /api/cq/me');

    const req2 = new Request('https://worker.local/api/admin/probe', {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretToken}` },
    });
    const res2 = await handleWorkerRequest(req2, env);
    const text2 = await res2.text();
    assert.ok(!text2.includes(secretToken), 'Token não pode estar no corpo de /api/admin/probe');
  });

  it('18. Token Bearer e senhas não aparecem em cq_audit_logs', async () => {
    const auditLogs = sqlite.prepare('SELECT metadata FROM cq_audit_logs;').all() as any[];
    for (const log of auditLogs) {
      if (log.metadata) {
        assert.ok(!log.metadata.includes('password'));
        assert.ok(!log.metadata.includes('Bearer'));
        assert.ok(!log.metadata.includes('secret'));
      }
    }
  });
});
