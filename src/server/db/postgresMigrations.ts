import { getPostgresAdminPool, withPostgresAdminTransaction } from './postgres';

export interface PostgresMigration {
  id: string;
  name: string;
  sql: string;
}

export const POSTGRES_MIGRATIONS: PostgresMigration[] = [
  {
    id: '001_create_schema_migrations',
    name: 'Create schema migrations tracking table',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    id: '002_create_users_table',
    name: 'Create users table with case-insensitive unique login index',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        login VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ NULL,
        last_login_at TIMESTAMPTZ NULL,
        password_changed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS users_login_lower_idx ON users (LOWER(login));
    `,
  },
  {
    id: '003_create_sessions_table',
    name: 'Create sessions table with foreign key and indexes for hashed token IDs',
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip VARCHAR(45) NULL,
        user_agent TEXT NULL
      );

      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
    `,
  },
  {
    id: '004_create_audit_logs_table',
    name: 'Create audit_logs table with JSONB metadata and user FK ON DELETE SET NULL',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event VARCHAR(50) NOT NULL,
        user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        login_attempted VARCHAR(100) NULL,
        ip VARCHAR(45) NULL,
        user_agent TEXT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NULL
      );

      CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs (timestamp DESC);
      CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);
    `,
  },
  {
    id: '005_create_cq_authorization_tables',
    name: 'Create cq_app_access and cq_app_roles tables for local CQ authorization decoupled from password store',
    sql: `
      CREATE TABLE IF NOT EXISTS cq_app_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        etn_user_id VARCHAR(100) NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS cq_app_access_etn_user_id_idx ON cq_app_access (etn_user_id);

      CREATE TABLE IF NOT EXISTS cq_app_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        access_id UUID NOT NULL REFERENCES cq_app_access(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        ufs TEXT[] NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS cq_app_roles_access_id_idx ON cq_app_roles (access_id);
      CREATE INDEX IF NOT EXISTS cq_app_roles_role_idx ON cq_app_roles (role);

      -- Adapt sessions table: remove obsolete FK to local users table and support string/UUID etn_user_id
      ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
      ALTER TABLE sessions ALTER COLUMN user_id TYPE VARCHAR(100);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS login VARCHAR(100);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS etn_token TEXT;
    `,
  },
];

export async function runPostgresMigrations(): Promise<string[]> {
  const pool = getPostgresAdminPool();
  const appUser = process.env.SQL_USER || 'ai_studio_app_user';

  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  const appliedIds = new Set(rows.map((r) => r.id));
  const newlyApplied: string[] = [];

  for (const migration of POSTGRES_MIGRATIONS) {
    if (!appliedIds.has(migration.id)) {
      await withPostgresAdminTransaction(async (client) => {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (id, name, applied_at) VALUES ($1, $2, NOW())',
          [migration.id, migration.name]
        );
      });
      newlyApplied.push(migration.id);
    }
  }

  // Ensure application user has necessary permissions on all tables and sequences
  if (appUser) {
    try {
      await pool.query(`
        GRANT USAGE ON SCHEMA public TO "${appUser}";
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${appUser}";
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${appUser}";
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${appUser}";
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${appUser}";
      `);
    } catch (permErr: any) {
      console.warn('[Postgres Migrations] Permission grant notice:', permErr.message);
    }
  }

  if (newlyApplied.length > 0) {
    console.log(`[Postgres Migrations] Applied ${newlyApplied.length} migration(s):`, newlyApplied);
  } else {
    console.log('[Postgres Migrations] Schema is up to date.');
  }

  return newlyApplied;
}
