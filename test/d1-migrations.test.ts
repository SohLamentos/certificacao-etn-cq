import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATION_PATH = path.resolve(process.cwd(), 'migrations', '0001_cq_authorization.sql');

describe('D1 Migration 0001: Validação Estrutural e Regras de Integridade (SQLite Local)', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    // Banco SQLite em memória com verificação rigorosa de chaves estrangeiras ativada
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');

    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    db.exec(migrationSql);
  });

  it('1. Script de migration executa com sucesso e é idempotente (IF NOT EXISTS)', () => {
    // Reexecutar a mesma migration não deve lançar erro
    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    assert.doesNotThrow(() => {
      db.exec(migrationSql);
    });

    // Validar existência das 4 tabelas
    const tablesStmt = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cq_%' ORDER BY name ASC"
    );
    const tables = tablesStmt.all().map((r: any) => r.name);
    assert.deepEqual(tables, ['cq_app_access', 'cq_app_roles', 'cq_app_scopes', 'cq_audit_logs']);
  });

  it('2. etn_user_id deve ser ÚNICO e obrigatório em cq_app_access', () => {
    const insertStmt = db.prepare(
      'INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?)'
    );

    insertStmt.run('acc-1', 'usr-canonical-uuid-1', 1);

    // Tentativa de duplicar o mesmo etn_user_id deve falhar
    assert.throws(() => {
      insertStmt.run('acc-2', 'usr-canonical-uuid-1', 1);
    }, /UNIQUE constraint failed/i);

    // etn_user_id nulo deve falhar
    assert.throws(() => {
      insertStmt.run('acc-null', null as any, 1);
    }, /NOT NULL constraint failed/i);
  });

  it('3. Roles permitidas (ADMIN, GESTOR, ANALISTA, CQ) são aceitas com sucesso', () => {
    const insertAccess = db.prepare(
      'INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?)'
    );
    insertAccess.run('acc-valid-roles', 'usr-canonical-multi-roles', 1);

    const insertRole = db.prepare(
      'INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?)'
    );

    assert.doesNotThrow(() => {
      insertRole.run('role-1', 'acc-valid-roles', 'ADMIN');
      insertRole.run('role-2', 'acc-valid-roles', 'GESTOR');
      insertRole.run('role-3', 'acc-valid-roles', 'ANALISTA');
      insertRole.run('role-4', 'acc-valid-roles', 'CQ');
    });

    const selectRoles = db.prepare(
      'SELECT role FROM cq_app_roles WHERE access_id = ? ORDER BY role ASC'
    );
    const roles = selectRoles.all('acc-valid-roles').map((r: any) => r.role);
    assert.deepEqual(roles, ['ADMIN', 'ANALISTA', 'CQ', 'GESTOR']);
  });

  it('4. Roles inválidas (MULTIPLICADOR, TECNICO, etc.) são rejeitadas pelo CHECK', () => {
    const insertAccess = db.prepare(
      'INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?)'
    );
    insertAccess.run('acc-invalid-role', 'usr-canonical-test', 1);

    const insertRole = db.prepare(
      'INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?)'
    );

    // MULTIPLICADOR é proibido no CQ
    assert.throws(() => {
      insertRole.run('role-inv-1', 'acc-invalid-role', 'MULTIPLICADOR');
    }, /CHECK constraint failed/i);

    // TECNICO é proibido no CQ
    assert.throws(() => {
      insertRole.run('role-inv-2', 'acc-invalid-role', 'TECNICO');
    }, /CHECK constraint failed/i);

    // Qualquer role aleatória é proibida
    assert.throws(() => {
      insertRole.run('role-inv-3', 'acc-invalid-role', 'SUPERUSER');
    }, /CHECK constraint failed/i);
  });

  it('5. Múltiplas roles para a mesma identidade são permitidas (ex: ANALISTA + CQ)', () => {
    const insertAccess = db.prepare(
      'INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?)'
    );
    insertAccess.run('acc-analista-cq', 'usr-canonical-dual-role', 1);

    const insertRole = db.prepare(
      'INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?)'
    );

    insertRole.run('r-analista', 'acc-analista-cq', 'ANALISTA');
    insertRole.run('r-cq', 'acc-analista-cq', 'CQ');

    const countStmt = db.prepare(
      'SELECT COUNT(*) as count FROM cq_app_roles WHERE access_id = ?'
    );
    const result: any = countStmt.get('acc-analista-cq');
    assert.equal(result.count, 2);
  });

  it('6. Role duplicada para a mesma identidade é rejeitada (UNIQUE access_id, role)', () => {
    const insertAccess = db.prepare(
      'INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?)'
    );
    insertAccess.run('acc-dup-role', 'usr-canonical-dup', 1);

    const insertRole = db.prepare(
      'INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?)'
    );

    insertRole.run('r-cq-1', 'acc-dup-role', 'CQ');

    // Tentar adicionar a mesma role CQ novamente para a mesma identidade
    assert.throws(() => {
      insertRole.run('r-cq-2', 'acc-dup-role', 'CQ');
    }, /UNIQUE constraint failed/i);
  });

  it('7. Escopo territorial relacional por UF: aceita 2 letras maiúsculas e rejeita inválidos', () => {
    const insertAccess = db.prepare(
      'INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?)'
    );
    insertAccess.run('acc-uf-test', 'usr-canonical-uf-test', 1);

    const insertScope = db.prepare(
      'INSERT INTO cq_app_scopes (id, access_id, uf) VALUES (?, ?, ?)'
    );

    // UFs válidas
    insertScope.run('sc-1', 'acc-uf-test', 'SP');
    insertScope.run('sc-2', 'acc-uf-test', 'RJ');

    // Rejeita nomes por extenso (ex: PARANA)
    assert.throws(() => {
      insertScope.run('sc-inv-1', 'acc-uf-test', 'PARANA');
    }, /CHECK constraint failed/i);

    // Rejeita formato alfanumérico (ex: PR1)
    assert.throws(() => {
      insertScope.run('sc-inv-2', 'acc-uf-test', 'PR1');
    }, /CHECK constraint failed/i);

    // Rejeita 1 única letra (ex: P)
    assert.throws(() => {
      insertScope.run('sc-inv-3', 'acc-uf-test', 'P');
    }, /CHECK constraint failed/i);

    // Rejeita minúsculas (ex: sp)
    assert.throws(() => {
      insertScope.run('sc-inv-4', 'acc-uf-test', 'sp');
    }, /CHECK constraint failed/i);

    // Rejeita duplicidade de UF para a mesma identidade
    assert.throws(() => {
      insertScope.run('sc-dup', 'acc-uf-test', 'SP');
    }, /UNIQUE constraint failed/i);

    const selectScopes = db.prepare(
      'SELECT uf FROM cq_app_scopes WHERE access_id = ? ORDER BY uf ASC'
    );
    const scopes = selectScopes.all('acc-uf-test').map((r: any) => r.uf);
    assert.deepEqual(scopes, ['RJ', 'SP']);
  });

  it('8. Remoção de cq_app_access: remove roles e escopos em cascata, mas PRESERVA audit_logs', () => {
    const insertAccess = db.prepare(
      'INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?)'
    );
    insertAccess.run('acc-cascade', 'usr-canonical-cascade', 1);

    const insertRole = db.prepare(
      'INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?)'
    );
    insertRole.run('r-casc-1', 'acc-cascade', 'CQ');

    const insertScope = db.prepare(
      'INSERT INTO cq_app_scopes (id, access_id, uf) VALUES (?, ?, ?)'
    );
    insertScope.run('s-casc-1', 'acc-cascade', 'SP');

    const insertAudit = db.prepare(`
      INSERT INTO cq_audit_logs (id, event, actor_etn_user_id, target_etn_user_id, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertAudit.run('aud-1', 'ACCESS_GRANTED', 'usr-admin', 'usr-canonical-cascade', '{"role":"CQ"}');

    // Deletar o registro de acesso
    const deleteStmt = db.prepare('DELETE FROM cq_app_access WHERE id = ?');
    deleteStmt.run('acc-cascade');

    // Confirmar que roles e scopes foram removidos em cascata
    const rolesStmt = db.prepare('SELECT COUNT(*) as count FROM cq_app_roles WHERE access_id = ?');
    const rolesResult: any = rolesStmt.get('acc-cascade');
    assert.equal(rolesResult.count, 0);

    const scopesStmt = db.prepare('SELECT COUNT(*) as count FROM cq_app_scopes WHERE access_id = ?');
    const scopesResult: any = scopesStmt.get('acc-cascade');
    assert.equal(scopesResult.count, 0);

    // Confirmar que o audit_log foi PRESERVADO integralmente
    const auditStmt = db.prepare('SELECT * FROM cq_audit_logs WHERE id = ?');
    const auditRow: any = auditStmt.get('aud-1');
    assert.ok(auditRow);
    assert.equal(auditRow.target_etn_user_id, 'usr-canonical-cascade');
    assert.equal(auditRow.event, 'ACCESS_GRANTED');
  });

  it('9. Flag enabled=0 e enabled=1 com CHECK constraint restritiva', () => {
    const insertAccess = db.prepare(
      'INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, ?)'
    );

    // Habilitado (1)
    insertAccess.run('acc-en-1', 'usr-en-1', 1);
    // Desabilitado (0)
    insertAccess.run('acc-en-0', 'usr-en-0', 0);

    // Valor inválido (ex: 2) deve falhar
    assert.throws(() => {
      insertAccess.run('acc-en-inv', 'usr-en-inv', 2);
    }, /CHECK constraint failed/i);

    // Consulta de autorização filtrando enabled=1
    const checkAuthStmt = db.prepare(`
      SELECT a.etn_user_id, r.role
      FROM cq_app_access a
      JOIN cq_app_roles r ON r.access_id = a.id
      WHERE a.etn_user_id = ? AND a.enabled = 1
    `);

    const insertRole = db.prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?)');
    insertRole.run('r-en-1', 'acc-en-1', 'CQ');
    insertRole.run('r-en-0', 'acc-en-0', 'CQ');

    const auth1: any = checkAuthStmt.get('usr-en-1');
    assert.ok(auth1);
    assert.equal(auth1.role, 'CQ');

    const auth0: any = checkAuthStmt.get('usr-en-0');
    assert.equal(auth0, undefined, 'Usuário desabilitado (enabled=0) não deve retornar autorização');
  });

  it('10. cq_audit_logs registra eventos de governança sem dados sensíveis', () => {
    const insertAudit = db.prepare(`
      INSERT INTO cq_audit_logs (id, event, actor_etn_user_id, target_etn_user_id, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    assert.doesNotThrow(() => {
      insertAudit.run(
        'audit-1',
        'ACCESS_GRANTED',
        'usr-admin-uuid',
        'usr-target-uuid',
        JSON.stringify({ roles: ['CQ'], ufs: ['SP'] })
      );
    });

    // Evento não permitido deve falhar
    assert.throws(() => {
      insertAudit.run('audit-inv', 'SENHA_ALTERADA', 'usr-1', 'usr-2', null);
    }, /CHECK constraint failed/i);

    const auditRow: any = db.prepare('SELECT * FROM cq_audit_logs WHERE id = ?').get('audit-1');
    assert.equal(auditRow.event, 'ACCESS_GRANTED');
    assert.equal(auditRow.target_etn_user_id, 'usr-target-uuid');
    assert.ok(auditRow.created_at);
  });
});
