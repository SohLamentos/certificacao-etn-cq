import crypto from 'node:crypto';
import { loadDatabase, saveDatabase } from '../db/store';
import { PostgresSessionRepository } from './postgresSessionRepository';
import { Session } from './types';

const DEFAULT_SESSION_HOURS = 24;

function isPostgres(): boolean {
  return process.env.DB_DRIVER === 'postgres';
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export class SessionRepository {
  static async createSession(
    userId: string,
    ttlHours: number = DEFAULT_SESSION_HOURS,
    ip?: string,
    userAgent?: string,
    etnToken?: string,
    login?: string,
    userName?: string
  ): Promise<Session> {
    if (isPostgres()) {
      return PostgresSessionRepository.createSession(userId, ttlHours, ip, userAgent, etnToken, login, userName);
    }

    const db = loadDatabase();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenDigest = hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    const sessionInDb: Session = {
      id: tokenDigest,
      user_id: userId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      ip,
      user_agent: userAgent,
      etn_token: etnToken,
      login,
      name: userName,
    };

    db.sessions.push(sessionInDb);
    saveDatabase(db);

    // Return session with raw token for HttpOnly cookie issuance
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

    if (isPostgres()) {
      return PostgresSessionRepository.getSession(rawToken);
    }

    const tokenDigest = hashToken(rawToken);
    const db = loadDatabase();
    const session = db.sessions.find((s) => s.id === tokenDigest);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expires_at) <= new Date()) {
      await this.deleteSession(rawToken);
      return null;
    }

    return {
      id: rawToken,
      user_id: session.user_id,
      created_at: session.created_at,
      expires_at: session.expires_at,
      ip: session.ip,
      user_agent: session.user_agent,
      etn_token: session.etn_token,
      login: session.login,
      name: session.name,
    };
  }

  static async deleteSession(rawToken: string): Promise<void> {
    if (!rawToken) return;

    if (isPostgres()) {
      return PostgresSessionRepository.deleteSession(rawToken);
    }

    const tokenDigest = hashToken(rawToken);
    const db = loadDatabase();
    db.sessions = db.sessions.filter((s) => s.id !== tokenDigest);
    saveDatabase(db);
  }

  static async deleteUserSessions(userId: string): Promise<void> {
    if (isPostgres()) {
      return PostgresSessionRepository.deleteUserSessions(userId);
    }

    const db = loadDatabase();
    db.sessions = db.sessions.filter((s) => s.user_id !== userId);
    saveDatabase(db);
  }

  static async cleanExpiredSessions(): Promise<number> {
    if (isPostgres()) {
      return PostgresSessionRepository.cleanExpiredSessions();
    }

    const db = loadDatabase();
    const now = new Date();
    const beforeCount = db.sessions.length;
    db.sessions = db.sessions.filter((s) => new Date(s.expires_at) > now);
    saveDatabase(db);
    return beforeCount - db.sessions.length;
  }
}
