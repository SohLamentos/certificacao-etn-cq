import { getPostgresPool } from '../db/postgres';
import { AuditLogEntry, AuditEventType } from './types';

export class PostgresAuditRepository {
  /**
   * Sanitizes metadata defensively to ensure credentials, tokens, and DB secrets
   * are strictly redacted before database persistence.
   */
  private static sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return undefined;
    const sanitized: Record<string, unknown> = {};
    const prohibitedKeys = new Set([
      'password',
      'password_hash',
      'hash',
      'token',
      'session_id',
      'cookie',
      'secret',
      'authorization',
      'admin_initial_password',
      'database_url',
    ]);

    for (const [key, value] of Object.entries(metadata)) {
      if (prohibitedKeys.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  static async log(params: {
    event: AuditEventType;
    user_id?: string | null;
    login_attempted?: string;
    ip?: string;
    user_agent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    const pool = getPostgresPool();
    const sanitizedMetadata = this.sanitizeMetadata(params.metadata);
    const sanitizedLogin = params.login_attempted
      ? params.login_attempted.toLowerCase().slice(0, 50)
      : null;
    const sanitizedUserAgent = params.user_agent ? params.user_agent.slice(0, 150) : null;

    const sql = `
      INSERT INTO audit_logs (
        event, user_id, login_attempted, ip, user_agent, timestamp, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), $6
      )
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [
      params.event,
      params.user_id || null,
      sanitizedLogin,
      params.ip || null,
      sanitizedUserAgent,
      sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : null,
    ]);

    const row = rows[0];
    return {
      id: row.id,
      event: row.event,
      user_id: row.user_id,
      login_attempted: row.login_attempted,
      ip: row.ip,
      user_agent: row.user_agent,
      timestamp: new Date(row.timestamp).toISOString(),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  }

  static async listRecent(limit: number = 50): Promise<AuditLogEntry[]> {
    const pool = getPostgresPool();
    const { rows } = await pool.query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );

    return rows.map((row) => ({
      id: row.id,
      event: row.event,
      user_id: row.user_id,
      login_attempted: row.login_attempted,
      ip: row.ip,
      user_agent: row.user_agent,
      timestamp: new Date(row.timestamp).toISOString(),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    }));
  }
}
