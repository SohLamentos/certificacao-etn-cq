import fs from 'node:fs';
import path from 'node:path';
import { User, Session, AuditLogEntry, CQAppAccessRecord, CQAppRoleRecord } from '../auth/types';

export interface MigrationRecord {
  id: string;
  name: string;
  applied_at: string;
}

export interface DatabaseSchema {
  version: number;
  users: User[];
  sessions: Session[];
  audit_logs: AuditLogEntry[];
  migrations: MigrationRecord[];
  cq_app_access: CQAppAccessRecord[];
  cq_app_roles: CQAppRoleRecord[];
}

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'app_db.json');

let dbInstance: DatabaseSchema | null = null;
let currentDbPath = process.env.DB_FILE_PATH || DEFAULT_DB_PATH;

export function setCustomDbPath(customPath: string) {
  currentDbPath = customPath;
  dbInstance = null;
}

export function getDefaultSchema(): DatabaseSchema {
  return {
    version: 1,
    users: [],
    sessions: [],
    audit_logs: [],
    migrations: [],
    cq_app_access: [],
    cq_app_roles: [],
  };
}

export function loadDatabase(): DatabaseSchema {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    if (fs.existsSync(currentDbPath)) {
      const raw = fs.readFileSync(currentDbPath, 'utf-8');
      dbInstance = JSON.parse(raw) as DatabaseSchema;
      // Ensure all arrays exist
      dbInstance.users = dbInstance.users || [];
      dbInstance.sessions = dbInstance.sessions || [];
      dbInstance.audit_logs = dbInstance.audit_logs || [];
      dbInstance.migrations = dbInstance.migrations || [];
      dbInstance.cq_app_access = dbInstance.cq_app_access || [];
      dbInstance.cq_app_roles = dbInstance.cq_app_roles || [];
      return dbInstance;
    }
  } catch (err) {
    console.error(`[DB] Error loading database from ${currentDbPath}, initializing fresh store:`, err);
  }

  dbInstance = getDefaultSchema();
  saveDatabase(dbInstance);
  return dbInstance;
}

export function saveDatabase(data?: DatabaseSchema): void {
  const toSave = data || dbInstance || getDefaultSchema();
  dbInstance = toSave;

  try {
    const dir = path.dirname(currentDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${currentDbPath}.tmp-${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(toSave, null, 2), 'utf-8');
    fs.renameSync(tempPath, currentDbPath);
  } catch (err) {
    console.error(`[DB] Failed to persist database to ${currentDbPath}:`, err);
  }
}

export function resetDatabase(): void {
  dbInstance = getDefaultSchema();
  saveDatabase(dbInstance);
}
