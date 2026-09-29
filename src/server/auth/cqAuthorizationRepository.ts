import crypto from 'node:crypto';
import { loadDatabase, saveDatabase } from '../db/store';
import { getPostgresPool } from '../db/postgres';
import { CQRole, CQAppAccessRecord, CQAppRoleRecord } from './types';

export interface CQAccessResolution {
  enabled: boolean;
  etn_user_id: string;
  primaryRole: CQRole;
  roles: CQRole[];
  ufs: string[];
}

function isPostgres(): boolean {
  return process.env.DB_DRIVER === 'postgres';
}

const ROLE_PRIORITY: Record<CQRole, number> = {
  ADMIN: 4,
  GESTOR: 3,
  ANALISTA: 2,
  CQ: 1,
};

export class CQAuthorizationRepository {
  /**
   * Consulta a autorização local do usuário pelo ID canônico da autoridade central (etn_user_id).
   * Retorna os papéis e UFs autorizados ou null se o usuário não possuir acesso habilitado.
   */
  public static async getAccessByEtnUserId(etnUserId: string): Promise<CQAccessResolution | null> {
    if (!etnUserId || typeof etnUserId !== 'string') return null;

    const normalizedId = etnUserId.trim();

    if (isPostgres()) {
      return this.getPostgresAccess(normalizedId);
    }

    return this.getJsonAccess(normalizedId);
  }

  /**
   * Concede ou atualiza acesso e perfis locais no Certificação CQ para uma identidade ETN.
   */
  public static async grantAccess(
    etnUserId: string,
    roles: CQRole[],
    ufs: string[] = []
  ): Promise<CQAccessResolution> {
    if (!etnUserId || typeof etnUserId !== 'string') {
      throw new Error('etnUserId is required');
    }
    if (!roles || roles.length === 0) {
      throw new Error('At least one role must be provided');
    }

    const normalizedId = etnUserId.trim();

    if (isPostgres()) {
      return this.grantPostgresAccess(normalizedId, roles, ufs);
    }

    return this.grantJsonAccess(normalizedId, roles, ufs);
  }

  /**
   * Revoga completamente o acesso local de uma identidade ETN.
   */
  public static async revokeAccess(etnUserId: string): Promise<void> {
    if (!etnUserId) return;
    const normalizedId = etnUserId.trim();

    if (isPostgres()) {
      const pool = getPostgresPool();
      await pool.query('DELETE FROM cq_app_access WHERE etn_user_id = $1', [normalizedId]);
      return;
    }

    const db = loadDatabase();
    const access = db.cq_app_access.find((a) => a.etn_user_id === normalizedId);
    if (access) {
      db.cq_app_roles = db.cq_app_roles.filter((r) => r.access_id !== access.id);
      db.cq_app_access = db.cq_app_access.filter((a) => a.id !== access.id);
      saveDatabase(db);
    }
  }

  /**
   * Ativa ou desativa temporariamente o acesso do usuário sem remover seus papéis.
   */
  public static async setAccessEnabled(etnUserId: string, enabled: boolean): Promise<void> {
    if (!etnUserId) return;
    const normalizedId = etnUserId.trim();

    if (isPostgres()) {
      const pool = getPostgresPool();
      await pool.query(
        'UPDATE cq_app_access SET enabled = $1, updated_at = NOW() WHERE etn_user_id = $2',
        [enabled, normalizedId]
      );
      return;
    }

    const db = loadDatabase();
    const access = db.cq_app_access.find((a) => a.etn_user_id === normalizedId);
    if (access) {
      access.enabled = enabled;
      access.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  }

  // =========================================================================
  // IMPLEMENTAÇÃO JSON (DEV & TEST)
  // =========================================================================

  private static getJsonAccess(etnUserId: string): CQAccessResolution | null {
    const db = loadDatabase();
    const access = db.cq_app_access.find((a) => a.etn_user_id === etnUserId);

    if (!access || !access.enabled) {
      return null;
    }

    const userRoles = db.cq_app_roles.filter((r) => r.access_id === access.id);
    if (userRoles.length === 0) {
      return null;
    }

    const distinctRoles = Array.from(new Set(userRoles.map((r) => r.role)));
    const allUfs = Array.from(new Set(userRoles.flatMap((r) => r.ufs || [])));

    // Determina primaryRole por prioridade
    distinctRoles.sort((a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0));
    const primaryRole = distinctRoles[0];

    return {
      enabled: access.enabled,
      etn_user_id: etnUserId,
      primaryRole,
      roles: distinctRoles,
      ufs: allUfs,
    };
  }

  private static grantJsonAccess(
    etnUserId: string,
    roles: CQRole[],
    ufs: string[]
  ): CQAccessResolution {
    const db = loadDatabase();
    const now = new Date().toISOString();

    let access = db.cq_app_access.find((a) => a.etn_user_id === etnUserId);

    if (!access) {
      access = {
        id: crypto.randomUUID(),
        etn_user_id: etnUserId,
        enabled: true,
        created_at: now,
        updated_at: now,
      };
      db.cq_app_access.push(access);
    } else {
      access.enabled = true;
      access.updated_at = now;
      // Remove existing roles for clean assignment
      db.cq_app_roles = db.cq_app_roles.filter((r) => r.access_id !== access!.id);
    }

    for (const role of roles) {
      const roleRecord: CQAppRoleRecord = {
        id: crypto.randomUUID(),
        access_id: access.id,
        role,
        ufs: ufs.length > 0 ? ufs : undefined,
        created_at: now,
      };
      db.cq_app_roles.push(roleRecord);
    }

    saveDatabase(db);

    const sortedRoles = [...roles].sort(
      (a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0)
    );

    return {
      enabled: true,
      etn_user_id: etnUserId,
      primaryRole: sortedRoles[0],
      roles: Array.from(new Set(roles)),
      ufs,
    };
  }

  // =========================================================================
  // IMPLEMENTAÇÃO POSTGRESQL (CLOUD SQL)
  // =========================================================================

  private static async getPostgresAccess(etnUserId: string): Promise<CQAccessResolution | null> {
    const pool = getPostgresPool();

    const accessRes = await pool.query<{ id: string; enabled: boolean }>(
      'SELECT id, enabled FROM cq_app_access WHERE etn_user_id = $1 LIMIT 1',
      [etnUserId]
    );

    if (accessRes.rows.length === 0 || !accessRes.rows[0].enabled) {
      return null;
    }

    const accessId = accessRes.rows[0].id;
    const rolesRes = await pool.query<{ role: string; ufs: string[] | null }>(
      'SELECT role, ufs FROM cq_app_roles WHERE access_id = $1',
      [accessId]
    );

    if (rolesRes.rows.length === 0) {
      return null;
    }

    const roles: CQRole[] = [];
    const ufsSet = new Set<string>();

    for (const row of rolesRes.rows) {
      const r = row.role.toUpperCase() as CQRole;
      if (['ADMIN', 'GESTOR', 'ANALISTA', 'CQ'].includes(r) && !roles.includes(r)) {
        roles.push(r);
      }
      if (Array.isArray(row.ufs)) {
        row.ufs.forEach((uf) => ufsSet.add(uf.trim().toUpperCase()));
      }
    }

    if (roles.length === 0) return null;

    roles.sort((a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0));

    return {
      enabled: true,
      etn_user_id: etnUserId,
      primaryRole: roles[0],
      roles,
      ufs: Array.from(ufsSet),
    };
  }

  private static async grantPostgresAccess(
    etnUserId: string,
    roles: CQRole[],
    ufs: string[]
  ): Promise<CQAccessResolution> {
    const pool = getPostgresPool();

    // Upsert access
    const upsertRes = await pool.query<{ id: string }>(
      `INSERT INTO cq_app_access (etn_user_id, enabled, updated_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (etn_user_id) DO UPDATE SET enabled = TRUE, updated_at = NOW()
       RETURNING id`,
      [etnUserId]
    );
    const accessId = upsertRes.rows[0].id;

    // Replace roles
    await pool.query('DELETE FROM cq_app_roles WHERE access_id = $1', [accessId]);

    for (const role of roles) {
      await pool.query(
        'INSERT INTO cq_app_roles (access_id, role, ufs) VALUES ($1, $2, $3)',
        [accessId, role, ufs.length > 0 ? ufs : null]
      );
    }

    const sortedRoles = [...roles].sort(
      (a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0)
    );

    return {
      enabled: true,
      etn_user_id: etnUserId,
      primaryRole: sortedRoles[0],
      roles: Array.from(new Set(roles)),
      ufs,
    };
  }
}
