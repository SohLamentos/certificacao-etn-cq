import pg from 'pg';
const { Pool } = pg;

export type PostgresPool = pg.Pool;
export type PostgresClient = pg.PoolClient;

declare global {
  var _postgresPool: pg.Pool | undefined;
  var _postgresAdminPool: pg.Pool | undefined;
}

export function getPostgresConfig(): pg.PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 15000,
    };
  }

  // Cloud SQL runtime environment variables for application DML user
  return {
    host: process.env.SQL_HOST || '127.0.0.1',
    user: process.env.SQL_USER || 'postgres',
    password: process.env.SQL_PASSWORD || '',
    database: process.env.SQL_DB_NAME || 'postgres',
    port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
    ssl: false,
    max: 10,
    connectionTimeoutMillis: 15000,
  };
}

export function getPostgresAdminConfig(): pg.PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 15000,
    };
  }

  const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'postgres';
  const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '';

  return {
    host: process.env.SQL_HOST || '127.0.0.1',
    user,
    password,
    database: process.env.SQL_DB_NAME || 'postgres',
    port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
    ssl: false,
    max: 5,
    connectionTimeoutMillis: 15000,
  };
}

export function getPostgresPool(): pg.Pool {
  if (!global._postgresPool) {
    const config = getPostgresConfig();
    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('[Postgres] Unexpected error on idle client:', err.message);
    });
  }
  return global._postgresPool;
}

export function getPostgresAdminPool(): pg.Pool {
  if (!global._postgresAdminPool) {
    const config = getPostgresAdminConfig();
    global._postgresAdminPool = new Pool(config);

    global._postgresAdminPool.on('error', (err) => {
      console.error('[Postgres Admin] Unexpected error on idle admin client:', err.message);
    });
  }
  return global._postgresAdminPool;
}

export async function closePostgresPool(): Promise<void> {
  if (global._postgresPool) {
    await global._postgresPool.end();
    global._postgresPool = undefined;
  }
  if (global._postgresAdminPool) {
    await global._postgresAdminPool.end();
    global._postgresAdminPool = undefined;
  }
}

export async function checkPostgresHealth(): Promise<boolean> {
  try {
    const pool = getPostgresPool();
    const result = await pool.query('SELECT 1 as healthy');
    return result.rows?.[0]?.healthy === 1;
  } catch (err) {
    return false;
  }
}

export async function withPostgresTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function withPostgresAdminTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPostgresAdminPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
