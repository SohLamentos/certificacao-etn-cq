import { Router, Request, Response } from 'express';
import { requireAuth, requireRole, requirePasswordNotPending } from '../auth/middleware';
import { UserRepository } from '../auth/userRepository';
import { AuditRepository } from '../auth/auditRepository';
import { loadDatabase } from '../db/store';

export const adminRouter = Router();

// Enforce strict authentication, ADMIN-only RBAC, and password not pending on all routes in this router
adminRouter.use(requireAuth);
adminRouter.use(requireRole('ADMIN'));
adminRouter.use(requirePasswordNotPending);

/**
 * GET /api/admin/dashboard
 * Protected stats overview for the administrator.
 */
adminRouter.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  const db = loadDatabase();
  const users = await UserRepository.list();
  const recentLogs = await AuditRepository.listRecent(10);

  res.status(200).json({
    status: 'ONLINE',
    admin_user: req.user?.login,
    metrics: {
      total_users: users.length,
      active_sessions: db.sessions.length,
      audit_events: db.audit_logs.length,
    },
    recent_activity: recentLogs,
  });
});

/**
 * GET /api/admin/users
 * Returns list of platform users. Never returns password_hash.
 */
adminRouter.get('/users', async (_req: Request, res: Response): Promise<void> => {
  const users = await UserRepository.list();
  const safeUsers = users.map((u) => UserRepository.toSafeUser(u));
  res.status(200).json({
    users: safeUsers,
  });
});

/**
 * GET /api/admin/audit-logs
 * Returns audit trail entries.
 */
adminRouter.get('/audit-logs', async (_req: Request, res: Response): Promise<void> => {
  const logs = await AuditRepository.listRecent(100);
  res.status(200).json({
    logs,
  });
});

/**
 * GET /api/admin/probe
 * Probe endpoint to verify RBAC server-side authorization.
 */
adminRouter.get('/probe', (req: Request, res: Response): void => {
  res.status(200).json({
    message: 'Acesso administrativo autorizado com sucesso.',
    authorized_role: req.user?.role,
    user: req.user,
  });
});
