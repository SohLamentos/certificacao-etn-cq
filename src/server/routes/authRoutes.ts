import { Router, Request, Response } from 'express';
import { EtnIdentityProvider } from '../auth/etnIdentityProvider';
import { CQAuthorizationRepository } from '../auth/cqAuthorizationRepository';
import { UserRepository } from '../auth/userRepository';
import { SessionRepository } from '../auth/sessionRepository';
import { AuditRepository } from '../auth/auditRepository';
import { requireAuth, SESSION_COOKIE_NAME, extractSessionToken } from '../auth/middleware';
import { SafeUser } from '../auth/types';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Autenticação delegada à autoridade central (ETN Materiais) via EtnIdentityProvider.
 * Autorização resolvida localmente no modelo CQ (cq_app_access / cq_app_roles).
 * NUNCA persiste senha, nunca loga senha, nunca retorna senha.
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { login, password } = req.body || {};

  if (!login || typeof login !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    return;
  }

  const normalizedLogin = login.trim().toLowerCase();
  const clientIp = req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // 1. Delegar autenticação para a autoridade central (ETN Materiais)
  const authResult = await EtnIdentityProvider.login({
    login: normalizedLogin,
    password,
  });

  // Se a autoridade central rejeitar ou estiver indisponível
  if (!authResult.success || !authResult.user || !authResult.token) {
    await AuditRepository.log({
      event: 'LOGIN_FAILED',
      login_attempted: normalizedLogin,
      ip: clientIp,
      user_agent: userAgent,
      metadata: { reason: authResult.error?.code || 'AUTH_REJECTED' },
    });

    const status = authResult.statusCode || 401;
    res.status(status).json({
      error: authResult.error?.message || 'Usuário ou senha inválidos.',
    });
    return;
  }

  const etnUser = authResult.user;
  const etnUserId = etnUser.id;

  // 2. Consultar autorização local no modelo próprio do Certificação CQ
  let localAccess = await CQAuthorizationRepository.getAccessByEtnUserId(etnUserId);

  // Fallback de compatibilidade transitória com usuários legados de desenvolvimento pré-federação
  if (!localAccess) {
    const legacyUser = await UserRepository.findByLogin(normalizedLogin);
    if (legacyUser && legacyUser.status === 'ACTIVE') {
      localAccess = {
        enabled: true,
        etn_user_id: etnUserId,
        primaryRole: legacyUser.role,
        roles: [legacyUser.role],
        ufs: [],
      };
    }
  }

  // Se o usuário não possui acesso local habilitado (ex: MULTIPLICADOR, TÉCNICO ou sem concessão CQ) -> 403
  if (!localAccess || !localAccess.enabled || localAccess.roles.length === 0) {
    await AuditRepository.log({
      event: 'ACCESS_DENIED',
      user_id: etnUserId,
      login_attempted: normalizedLogin,
      ip: clientIp,
      user_agent: userAgent,
      metadata: {
        reason: 'APPLICATION_ACCESS_DENIED',
        etn_role: etnUser.role,
      },
    });

    res.status(403).json({
      error: 'APPLICATION_ACCESS_DENIED',
      message: 'Seu perfil não possui acesso ao ETN Certificação CQ.',
    });
    return;
  }

  // 3. Criar sessão local do Certificação CQ (com digest SHA-256 no banco e token opaco no cookie)
  const session = await SessionRepository.createSession(
    etnUserId,
    24,
    clientIp,
    userAgent,
    authResult.token,
    etnUser.login,
    etnUser.displayName
  );

  // Set secure HttpOnly cookie containing raw session token
  res.cookie(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  await AuditRepository.log({
    event: 'LOGIN_SUCCESS',
    user_id: etnUserId,
    login_attempted: normalizedLogin,
    ip: clientIp,
    user_agent: userAgent,
    metadata: {
      primaryRole: localAccess.primaryRole,
      roles: localAccess.roles,
      etn_role: etnUser.role,
    },
  });

  const safeUser: SafeUser = {
    id: etnUserId,
    etn_user_id: etnUserId,
    login: etnUser.login,
    name: etnUser.displayName,
    role: localAccess.primaryRole,
    roles: localAccess.roles,
    ufs: localAccess.ufs,
    etn_role: etnUser.role,
    must_change_password: false,
    last_login_at: new Date().toISOString(),
  };

  res.status(200).json({
    user: safeUser,
    session: {
      id: session.id,
      expires_at: session.expires_at,
    },
  });
});

/**
 * POST /api/auth/logout
 * Invalida a sessão local e encaminha revogação para a autoridade central ETN.
 */
authRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const token = extractSessionToken(req);
  if (token) {
    const session = await SessionRepository.getSession(token);
    await SessionRepository.deleteSession(token);

    if (session?.etn_token) {
      try {
        await EtnIdentityProvider.logout(session.etn_token);
      } catch {
        // Silencioso
      }
    }

    await AuditRepository.log({
      event: 'LOGOUT',
      user_id: session?.user_id || null,
      ip: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

/**
 * GET /api/auth/me
 * Restaura e valida a sessão ativa no Certificação CQ.
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.status(200).json({
    user: req.user,
  });
});

/**
 * POST /api/auth/change-password
 * Desativado da arquitetura ativa do Certificação CQ (gestão de credenciais pertence ao ETN Materiais).
 */
authRouter.post('/change-password', requireAuth, (_req: Request, res: Response): void => {
  res.status(400).json({
    error: 'DEPRECATED_LOCAL_PASSWORD_MANAGEMENT',
    message: 'A gestão de senhas é centralizada no ETN Materiais. Altere sua senha pelo portal corporativo do ETN Materiais.',
  });
});
