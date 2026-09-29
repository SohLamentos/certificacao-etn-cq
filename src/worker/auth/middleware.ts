import { Env, EtnUser, CqContext, CqRole } from '../types';
import { EtnIdentityProvider } from './etnProvider';
import { CQAuthorizationRepository } from '../db/cqD1Repository';
import { buildCorsHeaders } from '../cors';

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export interface RequireIdentitySuccess {
  success: true;
  user: EtnUser;
  token: string;
}

export interface RequireFailure {
  success: false;
  response: Response;
}

export type RequireIdentityResult = RequireIdentitySuccess | RequireFailure;

export interface RequireAccessSuccess {
  success: true;
  context: CqContext;
  token: string;
}

export type RequireAccessResult = RequireAccessSuccess | RequireFailure;

/**
 * Middleware: Exige token ETN e valida identidade na autoridade central
 */
export async function requireEtnIdentity(
  request: Request,
  env: Env
): Promise<RequireIdentityResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Token de autorização central ETN ausente.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(request, env),
          },
        }
      ),
    };
  }

  const result = await EtnIdentityProvider.validateToken(env, token);
  if (!result.success || !result.user) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: result.error || 'UNAUTHORIZED',
          message: 'Sessão ou token ETN inválido ou expirado.',
        }),
        {
          status: result.status || 401,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(request, env),
          },
        }
      ),
    };
  }

  return {
    success: true,
    user: result.user,
    token,
  };
}

/**
 * Middleware: Exige identidade ETN + registro de acesso habilitado no CQ (D1)
 */
export async function requireCqAccess(
  request: Request,
  env: Env
): Promise<RequireAccessResult> {
  const identityResult = await requireEtnIdentity(request, env);
  if (identityResult.success === false) {
    return {
      success: false,
      response: identityResult.response,
    };
  }

  const { user, token } = identityResult;

  // Consultar cq_app_access no D1
  const access = await CQAuthorizationRepository.findAccessByEtnUserId(env.DB, user.id);

  if (!access) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: 'APPLICATION_ACCESS_DENIED',
          message: 'Usuário sem concessão de acesso ao Certificação CQ.',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(request, env),
          },
        }
      ),
    };
  }

  if (access.enabled !== 1) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: 'APPLICATION_ACCESS_DENIED',
          message: 'Acesso ao Certificação CQ está suspenso ou desabilitado.',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(request, env),
          },
        }
      ),
    };
  }

  // Carregar papéis e escopos territoriais
  const [roles, scopes] = await Promise.all([
    CQAuthorizationRepository.getRoles(env.DB, access.id),
    CQAuthorizationRepository.getScopes(env.DB, access.id),
  ]);

  return {
    success: true,
    token,
    context: {
      etnUser: user,
      access,
      roles,
      scopes,
    },
  };
}

/**
 * Middleware / Guard: Verifica se o contexto possui pelo menos uma das roles exigidas
 */
export function requireCqRole(
  request: Request,
  env: Env,
  context: CqContext,
  allowedRoles: CqRole[]
): Response | null {
  const hasRole = context.roles.some((r) => allowedRoles.includes(r));
  if (!hasRole) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'FORBIDDEN',
        message: 'Acesso negado. Perfil insuficiente para esta operação.',
        required_roles: allowedRoles,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...buildCorsHeaders(request, env),
        },
      }
    );
  }
  return null;
}
