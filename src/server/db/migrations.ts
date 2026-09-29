import { loadDatabase, saveDatabase, DatabaseSchema } from './store';

export interface Migration {
  id: string;
  name: string;
  up: (db: DatabaseSchema) => Promise<void> | void;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001_initial_auth_tables',
    name: 'Create users, sessions, and audit_logs storage collections',
    up: (db) => {
      if (!Array.isArray(db.users)) db.users = [];
      if (!Array.isArray(db.sessions)) db.sessions = [];
      if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
      if (!Array.isArray(db.migrations)) db.migrations = [];
    }
  },
  {
    id: '002_enforce_user_constraints',
    name: 'Normalize existing user logins to lowercase and validate schema constraints',
    up: (db) => {
      // Normalize any logins to lowercase and ensure default security attributes
      db.users.forEach((user) => {
        user.login = user.login.trim().toLowerCase();
        if (typeof user.failed_login_attempts !== 'number') {
          user.failed_login_attempts = 0;
        }
        if (typeof user.must_change_password !== 'boolean') {
          user.must_change_password = false;
        }
        if (!user.status) {
          user.status = 'ACTIVE';
        }
      });
    }
  }
];

export async function runMigrations(): Promise<string[]> {
  const db = loadDatabase();
  const appliedMigrationIds = new Set((db.migrations || []).map((m) => m.id));
  const newlyApplied: string[] = [];

  for (const migration of MIGRATIONS) {
    if (!appliedMigrationIds.has(migration.id)) {
      await migration.up(db);
      db.migrations.push({
        id: migration.id,
        name: migration.name,
        applied_at: new Date().toISOString(),
      });
      newlyApplied.push(migration.id);
    }
  }

  if (newlyApplied.length > 0) {
    saveDatabase(db);
    console.log(`[Migrations] Successfully applied ${newlyApplied.length} migration(s):`, newlyApplied);
  } else {
    console.log('[Migrations] Database is up to date.');
  }

  return newlyApplied;
}
