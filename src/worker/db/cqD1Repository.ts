import { CqAppAccess, CqRole, D1Database } from '../types';

export class CQAuthorizationRepository {
  /**
   * Localiza registro de acesso pelo UUID canônico da identidade ETN
   */
  static async findAccessByEtnUserId(
    db: D1Database,
    etnUserId: string
  ): Promise<CqAppAccess | null> {
    const stmt = db
      .prepare('SELECT id, etn_user_id, enabled, created_at, updated_at FROM cq_app_access WHERE etn_user_id = ?;')
      .bind(etnUserId);

    const result = await stmt.first<CqAppAccess>();
    return result || null;
  }

  /**
   * Obtém a lista de papéis (roles) atribuídos a um acesso local
   */
  static async getRoles(db: D1Database, accessId: string): Promise<CqRole[]> {
    const stmt = db
      .prepare('SELECT role FROM cq_app_roles WHERE access_id = ? ORDER BY role ASC;')
      .bind(accessId);

    const { results } = await stmt.all<{ role: CqRole }>();
    return (results || []).map((r) => r.role);
  }

  /**
   * Obtém a lista de UFs de escopo atribuídas a um acesso local
   */
  static async getScopes(db: D1Database, accessId: string): Promise<string[]> {
    const stmt = db
      .prepare('SELECT uf FROM cq_app_scopes WHERE access_id = ? ORDER BY uf ASC;')
      .bind(accessId);

    const { results } = await stmt.all<{ uf: string }>();
    return (results || []).map((r) => r.uf);
  }

  /**
   * Verifica se o usuário canônico ETN possui acesso habilitado (enabled = 1)
   */
  static async isEnabled(db: D1Database, etnUserId: string): Promise<boolean> {
    const access = await this.findAccessByEtnUserId(db, etnUserId);
    return access !== null && access.enabled === 1;
  }

  /**
   * Registra evento na trilha de auditoria forense do D1
   */
  static async logAudit(
    db: D1Database,
    event:
      | 'ACCESS_GRANTED'
      | 'ACCESS_REVOKED'
      | 'ACCESS_STATUS_CHANGED'
      | 'ROLE_ADDED'
      | 'ROLE_REMOVED'
      | 'SCOPE_ADDED'
      | 'SCOPE_REMOVED',
    actorUserId: string | null,
    targetUserId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const id = crypto.randomUUID();
    const metaStr = metadata ? JSON.stringify(metadata) : null;

    await db
      .prepare(
        'INSERT INTO cq_audit_logs (id, event, actor_etn_user_id, target_etn_user_id, metadata) VALUES (?, ?, ?, ?, ?);'
      )
      .bind(id, event, actorUserId, targetUserId, metaStr)
      .run();
  }

  /**
   * Concede acesso inicial ao Certificação CQ vinculando roles e escopos de UF
   */
  static async grantAccess(
    db: D1Database,
    etnUserId: string,
    roles: CqRole[],
    ufs: string[],
    actorUserId: string | null = null
  ): Promise<string> {
    const existing = await this.findAccessByEtnUserId(db, etnUserId);
    if (existing) {
      if (existing.enabled === 0) {
        await this.enableAccess(db, etnUserId, actorUserId);
      }
      await this.setRoles(db, existing.id, roles);
      await this.setScopes(db, existing.id, ufs);
      return existing.id;
    }

    const accessId = crypto.randomUUID();

    // Inserção atômica no D1
    const statements = [
      db
        .prepare('INSERT INTO cq_app_access (id, etn_user_id, enabled) VALUES (?, ?, 1);')
        .bind(accessId, etnUserId),
    ];

    for (const role of roles) {
      statements.push(
        db
          .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
          .bind(crypto.randomUUID(), accessId, role)
      );
    }

    for (const uf of ufs) {
      statements.push(
        db
          .prepare('INSERT INTO cq_app_scopes (id, access_id, uf) VALUES (?, ?, ?);')
          .bind(crypto.randomUUID(), accessId, uf.toUpperCase())
      );
    }

    await db.batch(statements);

    await this.logAudit(db, 'ACCESS_GRANTED', actorUserId, etnUserId, {
      roles,
      ufs,
    });

    return accessId;
  }

  /**
   * Desabilita temporariamente o acesso do colaborador (enabled = 0)
   */
  static async disableAccess(
    db: D1Database,
    etnUserId: string,
    actorUserId: string | null = null
  ): Promise<boolean> {
    const result = await db
      .prepare(
        "UPDATE cq_app_access SET enabled = 0, updated_at = datetime('now') WHERE etn_user_id = ?;"
      )
      .bind(etnUserId)
      .run();

    if (result.meta?.changes && result.meta.changes > 0) {
      await this.logAudit(db, 'ACCESS_STATUS_CHANGED', actorUserId, etnUserId, {
        enabled: 0,
      });
      return true;
    }
    return false;
  }

  /**
   * Reabilita o acesso do colaborador (enabled = 1)
   */
  static async enableAccess(
    db: D1Database,
    etnUserId: string,
    actorUserId: string | null = null
  ): Promise<boolean> {
    const result = await db
      .prepare(
        "UPDATE cq_app_access SET enabled = 1, updated_at = datetime('now') WHERE etn_user_id = ?;"
      )
      .bind(etnUserId)
      .run();

    if (result.meta?.changes && result.meta.changes > 0) {
      await this.logAudit(db, 'ACCESS_STATUS_CHANGED', actorUserId, etnUserId, {
        enabled: 1,
      });
      return true;
    }
    return false;
  }

  /**
   * Atualiza roles de um acesso
   */
  static async setRoles(
    db: D1Database,
    accessId: string,
    roles: CqRole[]
  ): Promise<void> {
    const statements = [
      db.prepare('DELETE FROM cq_app_roles WHERE access_id = ?;').bind(accessId),
    ];

    for (const role of roles) {
      statements.push(
        db
          .prepare('INSERT INTO cq_app_roles (id, access_id, role) VALUES (?, ?, ?);')
          .bind(crypto.randomUUID(), accessId, role)
      );
    }

    await db.batch(statements);
  }

  /**
   * Atualiza escopos de UF de um acesso
   */
  static async setScopes(
    db: D1Database,
    accessId: string,
    ufs: string[]
  ): Promise<void> {
    const statements = [
      db.prepare('DELETE FROM cq_app_scopes WHERE access_id = ?;').bind(accessId),
    ];

    for (const uf of ufs) {
      statements.push(
        db
          .prepare('INSERT INTO cq_app_scopes (id, access_id, uf) VALUES (?, ?, ?);')
          .bind(crypto.randomUUID(), accessId, uf.toUpperCase())
      );
    }

    await db.batch(statements);
  }
}
