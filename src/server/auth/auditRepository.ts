import crypto from 'node:crypto';
import { loadDatabase, saveDatabase } from '../db/store';
import { PostgresAuditRepository } from './postgresAuditRepository';
import { AuditLogEntry, AuditEventType } from './types';

function isPostgres(): boolean {
  return process.env.DB_DRIVER === 'postgres';
}

export class AuditRepository {
  /**
   * Sanitizes any metadata object to guarantee no sensitive credentials or hashes leak.
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
    if (isPostgres()) {
      return PostgresAuditRepository.log(params);
    }

    const db = loadDatabase();
    const entry: AuditLogEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event: params.event,
      user_id: params.user_id || null,
      login_attempted: params.login_attempted ? params.login_attempted.toLowerCase().slice(0, 50) : undefined,
      ip: params.ip,
      user_agent: params.user_agent ? params.user_agent.slice(0, 150) : undefined,
      timestamp: new Date().toISOString(),
      metadata: this.sanitizeMetadata(params.metadata),
    };

    db.audit_logs.push(entry);
    if (db.audit_logs.length > 1000) {
      db.audit_logs = db.audit_logs.slice(-1000);
    }
    saveDatabase(db);
    return entry;
  }

  static async listRecent(limit: number = 50): Promise<AuditLogEntry[]> {
    if (isPostgres()) {
      return PostgresAuditRepository.listRecent(limit);
    }

    const db = loadDatabase();
    return [...db.audit_logs].reverse().slice(0, limit);
  }
}
