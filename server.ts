import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { runMigrations } from './src/server/db/migrations';
import { runPostgresMigrations } from './src/server/db/postgresMigrations';
import { checkPostgresHealth } from './src/server/db/postgres';
import { bootstrapAdmin } from './src/server/auth/bootstrap';
import { authRouter } from './src/server/routes/authRoutes';
import { adminRouter } from './src/server/routes/adminRoutes';

const PORT = 3000;
const HOST = '0.0.0.0';

export function getEffectiveDbDriver(): string {
  if (process.env.DB_DRIVER) return process.env.DB_DRIVER;
  if (process.env.NODE_ENV === 'production') return 'postgres';
  if (process.env.SQL_HOST) return 'postgres';
  return 'json';
}

export function isDatabaseConfigValid(): { valid: boolean; reason?: string } {
  const isProduction = process.env.NODE_ENV === 'production';
  const dbDriver = getEffectiveDbDriver();

  if (isProduction && dbDriver !== 'postgres') {
    return {
      valid: false,
      reason:
        '[FATAL SECURITY CONFIGURATION ERROR] In production environment (NODE_ENV=production), DB_DRIVER must be strictly set to "postgres". Fallback to non-postgres storage is forbidden.',
    };
  }

  return { valid: true };
}

export async function createExpressApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Health check endpoint (never exposes internal hosts, users, or credentials)
  app.get('/api/health', async (_req, res) => {
    const dbDriver = getEffectiveDbDriver();

    let dbConnected = false;
    if (dbDriver === 'postgres') {
      dbConnected = await checkPostgresHealth();
    } else {
      // Local dev / test JSON store
      dbConnected = true;
    }

    const statusCode = dbConnected ? 200 : 503;
    res.status(statusCode).json({
      status: dbConnected ? 'HEALTHY' : 'UNHEALTHY',
      database: dbConnected ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API endpoints
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  return app;
}

export async function initializeDatabase() {
  const isProduction = process.env.NODE_ENV === 'production';
  const dbDriver = getEffectiveDbDriver();

  // Rule: Fail-closed in production
  const validation = isDatabaseConfigValid();
  if (!validation.valid) {
    console.error(validation.reason);
    throw new Error(validation.reason);
  }

  if (dbDriver === 'postgres') {
    console.log('[Database] Initializing PostgreSQL storage driver (Cloud SQL)...');
    try {
      await runPostgresMigrations();
      console.log('[Database] PostgreSQL migrations applied successfully.');
    } catch (err: any) {
      console.error('[Database] Failed to initialize PostgreSQL connection or migrations:', err.message);
      if (isProduction) {
        throw new Error(`[Database] Production initialization failed. PostgreSQL required.`);
      }
    }
  } else {
    console.log('[Database] Initializing local JSON storage driver (DEV/TEST)...');
    await runMigrations();
  }

  // Idempotently bootstrap initial ADMIN only when explicitly requested
  if (process.env.ENABLE_ADMIN_BOOTSTRAP === 'true') {
    await bootstrapAdmin();
  }
}

export async function startServer() {
  // Step 1: Initialize database according to environment rules
  await initializeDatabase();

  // Step 2: Initialize Express
  const app = await createExpressApp();

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development mode: Mount Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`[Server] Certificação Prática CQ running on http://${HOST}:${PORT}`);
  });

  return server;
}

// Start server if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.ts')) {
  startServer().catch((err) => {
    console.error('[Server] Fatal error on startup:', err);
    process.exit(1);
  });
}
