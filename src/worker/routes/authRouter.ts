import { Env } from '../types';
import { EtnIdentityProvider } from '../auth/etnProvider';
import { CQAuthorizationRepository } from '../db/cqD1Repository';
import { requireEtnIdentity, extractBearerToken } from '../auth/middleware';
import { buildCorsHeaders } from '../cors';

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const corsHeaders = buildCorsHeaders(request, env);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'INVALID_JSON',
        message: 'Payload JSON inválido.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const loginStr = typeof body?.login === 'string' ? body.login.trim() : '';
  const passwordStr = typeof body?.password === 'string' ? body.password : '';

  if (!loginStr || !passwordStr) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'MISSING_CREDENTIALS',
        message: 'Login e senha são obrigatórios.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  // 1. Autenticar no provedor central ETN Materiais (MAT_API)
  const loginResult = await EtnIdentityProvider.login(env, loginStr, passwordStr);
  if (!loginResult.success || !loginResult.user) {
    return new Response(
      JSON.stringify({
        success: false,
        error: loginResult.error || 'UNAUTHORIZED',
        message: loginResult.message || 'Credenciais inválidas.',
      }),
      {
        status: loginResult.status || 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const { user, token } = loginResult;

  // 2. Verificar se a identidade possui acesso concedido no Certificação CQ (D1)
  const access = await CQAuthorizationRepository.findAccessByEtnUserId(env.DB, user.id);

  if (!access) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'APPLICATION_ACCESS_DENIED',
        message: 'Usuário sem concessão de acesso ao Certificação CQ.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  if (access.enabled !== 1) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'APPLICATION_ACCESS_DENIED',
        message: 'Acesso ao Certificação CQ está suspenso ou desabilitado.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  // 3. Carregar roles e escopos locais autorizados
  const [roles, scopes] = await Promise.all([
    CQAuthorizationRepository.getRoles(env.DB, access.id),
    CQAuthorizationRepository.getScopes(env.DB, access.id),
  ]);

  return new Response(
    JSON.stringify({
      success: true,
      token,
      user,
      cq_access: {
        id: access.id,
        enabled: true,
        roles,
        scopes,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
}

export async function handleAuthMe(request: Request, env: Env): Promise<Response> {
  const result = await requireEtnIdentity(request, env);
  if (result.success === false) {
    return result.response;
  }

  return new Response(
    JSON.stringify({
      success: true,
      user: result.user,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...buildCorsHeaders(request, env),
      },
    }
  );
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const token = extractBearerToken(request);
  if (token) {
    await EtnIdentityProvider.logout(env, token);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Logout realizado com sucesso.',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...buildCorsHeaders(request, env),
      },
    }
  );
}
