import crypto from 'node:crypto';
import { getPostgresPool } from '../db/postgres';
import { Session } from './types';

const DEFAULT_SESSION_HOURS = 24;

export class PostgresSessionRepository {
  /**
   * Hashes the raw token using SHA-256 before database lookup/storage.
   * Prevents raw session hijacking if the database sessions table is dumped.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  static async createSession(
    userId: string,
    ttlHours: number = DEFAULT_SESSION_HOURS,
    ip?: string,
    userAgent?: string,
    etnToken?: string,
    login?: string,
    userName?: string
  ): Promise<Session> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenDigest = this.hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    const pool = getPostgresPool();
    const sql = `
      INSERT INTO sessions (id, user_id, expires_at, created_at, ip, user_agent, etn_token, login, user_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    try {
      await pool.query(sql, [
        tokenDigest,
        userId,
        expiresAt.toISOString(),
        now.toISOString(),
        ip || null,
        userAgent || null,
        etnToken || null,
        login || null,
        userName || null,
      ]);
    } catch {
      // Fallback if migration 005 has not been run yet
      await pool.query(
        `INSERT INTO sessions (id, user_id, expires_at, created_at, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tokenDigest, userId, expiresAt.toISOString(), now.toISOString(), ip || null, userAgent || null]
      );
    }

    // Return session object with the rawToken so the caller can set the HttpOnly cookie
    return {
      id: rawToken,
      user_id: userId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      ip,
      user_agent: userAgent,
      etn_token: etnToken,
      login,
      name: userName,
    };
  }

  static async getSession(rawToken: string): Promise<Session | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenDigest = this.hashToken(rawToken);
    const pool = getPostgresPool();

    const { rows } = await pool.query(
      'SELECT * FROM sessions WHERE id = $1 LIMIT 1',
      [tokenDigest]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    const expiresAt = new Date(row.expires_at);

    if (expiresAt <= new Date()) {
      await this.deleteSession(rawToken);
      return null;
    }

    return {
      id: rawToken,
      user_id: row.user_id,
      created_at: new Date(row.created_at).toISOString(),
      expires_at: expiresAt.toISOString(),
      ip: row.ip,
      user_agent: row.user_agent,
      etn_token: row.etn_token,
      login: row.login,
      name: row.user_name,
    };
  }

  static async deleteSession(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenDigest = this.hashToken(rawToken);
    const pool = getPostgresPool();
    await pool.query('DELETE FROM sessions WHERE id = $1', [tokenDigest]);
  }

  static async deleteUserSessions(userId: string): Promise<void> {
    const pool = getPostgresPool();
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  static async cleanExpiredSessions(): Promise<number> {
    const pool = getPostgresPool();
    const result = await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    return result.rowCount || 0;
  }
}
