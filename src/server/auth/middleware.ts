import { Request, Response, NextFunction } from 'express';
import { SessionRepository } from './sessionRepository';
import { CQAuthorizationRepository } from './cqAuthorizationRepository';
import { UserRepository } from './userRepository';
import { AuditRepository } from './auditRepository';
import { SafeUser, Session, CQRole } from './types';

// Augment Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      session?: Session;
    }
  }
}

export const SESSION_COOKIE_NAME = 'cq_session';

export function extractSessionToken(req: Request): string | null {
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractSessionToken(req);

  if (!token) {
    res.status(401).json({ error: 'Não autenticado. Por favor, faça login.' });
    return;
  }

  const session = await SessionRepository.getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Por favor, faça login novamente.' });
    return;
  }

  // 1. Verificar autorização local no modelo CQ (cq_app_access / cq_app_roles)
  const localAccess = await CQAuthorizationRepository.getAccessByEtnUserId(session.user_id);

  if (localAccess && localAccess.enabled && localAccess.roles.length > 0) {
    req.user = {
      id: session.user_id,
      etn_user_id: session.user_id,
      login: session.login || 'usuario',
      name: session.name || 'Usuário CQ',
      role: localAccess.primaryRole,
      roles: localAccess.roles,
      ufs: localAccess.ufs,
      must_change_password: false,
    };
    req.session = session;
    next();
    return;
  }

  // 2. Se localAccess existir e estiver explicitamente desabilitado ou sem roles -> 403
  if (localAccess && (!localAccess.enabled || localAccess.roles.length === 0)) {
    await SessionRepository.deleteSession(token);
    res.status(403).json({
      error: 'APPLICATION_ACCESS_DENIED',
      message: 'Seu perfil não possui acesso ao ETN Certificação CQ.',
    });
    return;
  }

  // 3. Fallback transitório para usuários legados cadastrados durante fase pré-federação
  const legacyUser = await UserRepository.findById(session.user_id);
  if (legacyUser) {
    if (legacyUser.status === 'BLOCKED') {
      res.status(403).json({ error: 'Conta bloqueada. Contate o administrador.' });
      return;
    }

    if (legacyUser.status === 'INACTIVE') {
      res.status(403).json({ error: 'Conta inativa. Contate o administrador.' });
      return;
    }

    req.user = UserRepository.toSafeUser(legacyUser);
    req.session = session;
    next();
    return;
  }

  // Se não possui nem autorização CQ nem cadastro legado ativo -> FAIL-CLOSED (403)
  await SessionRepository.deleteSession(token);
  res.status(403).json({
    error: 'APPLICATION_ACCESS_DENIED',
    message: 'Seu perfil não possui acesso ao ETN Certificação CQ.',
  });
}

/**
 * Middleware: Blocks access to operational/administrative endpoints if password change is pending.
 */
export function requirePasswordNotPending(req: Request, res: Response, next: NextFunction): void {
  if (req.user && req.user.must_change_password) {
    res.status(403).json({
      error: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Troca de senha obrigatória antes de acessar recursos operacionais ou administrativos.',
    });
    return;
  }
  next();
}

export function requireRole(...allowedRoles: CQRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    const userRoles = req.user.roles && req.user.roles.length > 0 ? req.user.roles : [req.user.role];
    const hasRole = userRoles.some((r) => allowedRoles.includes(r as CQRole));

    if (!hasRole) {
      AuditRepository.log({
        event: 'ACCESS_DENIED',
        user_id: req.user.id,
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: {
          attempted_role: req.user.role,
          user_roles: userRoles,
          required_roles: allowedRoles,
          path: req.originalUrl,
          method: req.method,
        },
      });

      res.status(403).json({ error: 'Acesso negado. Permissão insuficiente.' });
      return;
    }

    if (req.user.must_change_password) {
      res.status(403).json({
        error: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Troca de senha obrigatória antes de acessar recursos operacionais ou administrativos.',
      });
      return;
    }

    next();
  };
}
