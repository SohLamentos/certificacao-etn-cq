import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { checkPostgresHealth, getPostgresPool, withPostgresTransaction, closePostgresPool } from '../src/server/db/postgres';
import { runPostgresMigrations } from '../src/server/db/postgresMigrations';
import { PostgresUserRepository } from '../src/server/auth/postgresUserRepository';
import { PostgresSessionRepository } from '../src/server/auth/postgresSessionRepository';
import { PostgresAuditRepository } from '../src/server/auth/postgresAuditRepository';
import { hashPassword } from '../src/server/auth/password';

describe('PostgreSQL Integration Test Suite (Cloud SQL Real Target)', async () => {
  const isPostgresAvailable = await checkPostgresHealth();

  if (!isPostgresAvailable) {
    it('Integration Gate: Cloud SQL / PostgreSQL availability', (t) => {
      t.skip(
        'NOT RUN — INFRASTRUCTURE REQUIRED: Nenhuma instância real de PostgreSQL / Cloud SQL está acessível no ambiente atual. Aguardando aprovação/provisionamento de infraestrutura.'
      );
    });
    return;
  }

  before(async () => {
    // Ensure migrations are executed on the real database
    await runPostgresMigrations();
  });

  after(async () => {
    // Clean test data to ensure clean schema (Admin bootstrap must NOT be created yet)
    const pool = getPostgresPool();
    await pool.query('DELETE FROM users WHERE login LIKE \'%test%\' OR login LIKE \'%concurrent%\' OR login LIKE \'%session%\' OR login LIKE \'%audit%\';');
    await closePostgresPool();
  });

  it('1. Real PostgreSQL: Migrations executadas e idempotentes', async () => {
    const newlyApplied = await runPostgresMigrations();
    assert.deepEqual(newlyApplied, []);

    const pool = getPostgresPool();
    const { rows } = await pool.query('SELECT id FROM schema_migrations ORDER BY applied_at ASC;');
    const ids = rows.map((r: any) => r.id);
    assert.ok(ids.includes('001_create_schema_migrations'));
    assert.ok(ids.includes('002_create_users_table'));
    assert.ok(ids.includes('003_create_sessions_table'));
    assert.ok(ids.includes('004_create_audit_logs_table'));
  });

  it('2. Real PostgreSQL: Unicidade case-insensitive e busca case-insensitive', async () => {
    const pwdHash = await hashPassword('Secret123!');
    const user = await PostgresUserRepository.create({
      login: 'analista.teste',
      name: 'Analista de Teste',
      password_hash: pwdHash,
      role: 'ANALISTA',
    });
    assert.equal(user.login, 'analista.teste');

    // Case-insensitive lookup
    const foundUpper = await PostgresUserRepository.findByLogin('ANALISTA.TESTE');
    assert.ok(foundUpper);
    assert.equal(foundUpper?.id, user.id);

    // Rejection of duplicate case-insensitive login
    await assert.rejects(async () => {
      await PostgresUserRepository.create({
        login: 'ANALISTA.TESTE',
        name: 'Analista Duplicado',
        password_hash: pwdHash,
        role: 'ANALISTA',
      });
    }, /already exists/);
  });

  it('3. Real PostgreSQL: Remoção de sessões do usuário com deleteUserSessions', async () => {
    const pwdHash = await hashPassword('Secret123!');
    const user = await PostgresUserRepository.create({
      login: 'session.user.test',
      name: 'Usuario Sessao Teste',
      password_hash: pwdHash,
      role: 'CQ',
    });

    const session = await PostgresSessionRepository.createSession(user.id, 1);
    const retrieved = await PostgresSessionRepository.getSession(session.id);
    assert.ok(retrieved);

    await PostgresSessionRepository.deleteUserSessions(user.id);

    const afterDelete = await PostgresSessionRepository.getSession(session.id);
    assert.equal(afterDelete, null);

    const pool = getPostgresPool();
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  });

  it('4. Real PostgreSQL: FK ON DELETE SET NULL em audit_logs', async () => {
    const pwdHash = await hashPassword('Secret123!');
    const user = await PostgresUserRepository.create({
      login: 'audit.user.test',
      name: 'Usuario Auditoria Teste',
      password_hash: pwdHash,
      role: 'CQ',
    });

    const entry = await PostgresAuditRepository.log({
      event: 'LOGIN_SUCCESS',
      user_id: user.id,
      login_attempted: 'audit.user.test',
    });

    const pool = getPostgresPool();
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

    const { rows } = await pool.query('SELECT user_id FROM audit_logs WHERE id = $1', [entry.id]);
    assert.equal(rows[0].user_id, null);
  });

  it('5. Real PostgreSQL: Session Token Digest (SHA-256 no banco, token bruto no retorno)', async () => {
    const pwdHash = await hashPassword('Secret123!');
    const user = await PostgresUserRepository.create({
      login: 'digest.user.test',
      name: 'Usuario Digest Teste',
      password_hash: pwdHash,
      role: 'CQ',
    });

    const session = await PostgresSessionRepository.createSession(user.id, 2);
    const rawToken = session.id;
    const expectedDigest = crypto.createHash('sha256').update(rawToken).digest('hex');

    const pool = getPostgresPool();
    const { rows } = await pool.query('SELECT id, user_id FROM sessions WHERE id = $1', [expectedDigest]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, expectedDigest);
    assert.notEqual(rows[0].id, rawToken);

    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  });

  it('6. Real PostgreSQL: Transações com Rollback em caso de erro', async () => {
    const pool = getPostgresPool();
    const initialCountRes = await pool.query('SELECT COUNT(*)::int as count FROM users');
    const initialCount = initialCountRes.rows[0].count;

    await assert.rejects(async () => {
      await withPostgresTransaction(async (client) => {
        await client.query(`
          INSERT INTO users (login, name, password_hash, role, status)
          VALUES ('rollback.user.test', 'Rollback User', 'hash', 'CQ', 'ACTIVE');
        `);
        throw new Error('Simulated transaction failure for rollback');
      });
    }, /Simulated transaction failure/);

    const afterCountRes = await pool.query('SELECT COUNT(*)::int as count FROM users');
    assert.equal(afterCountRes.rows[0].count, initialCount);
  });

  it('7. Real PostgreSQL: Bloqueio transacional concorrente com SELECT ... FOR UPDATE', async () => {
    const pwdHash = await hashPassword('Secret123!');
    const user = await PostgresUserRepository.create({
      login: 'concurrent.login.test',
      name: 'Usuario Concorrente',
      password_hash: pwdHash,
      role: 'CQ',
    });

    // Run 5 concurrent failed attempts in parallel against real Cloud SQL
    const promises = Array.from({ length: 5 }).map(() =>
      PostgresUserRepository.recordFailedAttempt(user.id, 5, 15)
    );
    await Promise.all(promises);

    const updated = await PostgresUserRepository.findById(user.id);
    assert.equal(updated?.failed_login_attempts, 5);
    assert.ok(updated?.locked_until);

    const pool = getPostgresPool();
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  });

  it('8. Real PostgreSQL: Advisory Lock para Bootstrap Concorrente', async () => {
    let lock1Acquired = false;
    let lock2Acquired = false;

    // Test that pg_advisory_xact_lock is supported and operational on Cloud SQL
    await withPostgresTransaction(async (client) => {
      const res = await client.query("SELECT pg_advisory_xact_lock(hashtext('admin_bootstrap'))");
      assert.equal(res.command, 'SELECT');
      lock1Acquired = true;
    });

    await withPostgresTransaction(async (client) => {
      const res = await client.query("SELECT pg_advisory_xact_lock(hashtext('admin_bootstrap'))");
      assert.equal(res.command, 'SELECT');
      lock2Acquired = true;
    });

    assert.equal(lock1Acquired, true);
    assert.equal(lock2Acquired, true);
  });

  it('9. Real PostgreSQL: Health check confirma conexão ativa', async () => {
    const isHealthy = await checkPostgresHealth();
    assert.equal(isHealthy, true);
  });
});
