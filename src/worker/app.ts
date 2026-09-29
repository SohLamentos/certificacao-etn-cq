import { Env } from './types';
import { buildCorsHeaders, handleCorsPreflight } from './cors';
import { handleHealth } from './routes/healthRouter';
import { handleLogin, handleAuthMe, handleLogout } from './routes/authRouter';
import { handleCqMe } from './routes/cqRouter';
import { handleAdminProbe } from './routes/adminRouter';

export async function handleWorkerRequest(request: Request, env: Env): Promise<Response> {
  // 1. Tratamento global de CORS Preflight (OPTIONS)
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight(request, env);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // 2. Roteamento nativo Fetch API
    if (method === 'GET' && path === '/api/health') {
      return await handleHealth(request, env);
    }

    if (method === 'POST' && path === '/api/auth/login') {
      return await handleLogin(request, env);
    }

    if (method === 'GET' && path === '/api/auth/me') {
      return await handleAuthMe(request, env);
    }

    if (method === 'POST' && path === '/api/auth/logout') {
      return await handleLogout(request, env);
    }

    if (method === 'GET' && path === '/api/cq/me') {
      return await handleCqMe(request, env);
    }

    if (method === 'GET' && path === '/api/admin/probe') {
      return await handleAdminProbe(request, env);
    }

    // 3. 404 para rotas não mapeadas
    return new Response(
      JSON.stringify({
        success: false,
        error: 'NOT_FOUND',
        message: `Rota ${method} ${path} não encontrada no Worker Certificação CQ.`,
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...buildCorsHeaders(request, env),
        },
      }
    );
  } catch (error) {
    // 4. Tratamento global de exceções (Fail-closed)
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(
      JSON.stringify({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Erro interno ao processar requisição no Worker.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...buildCorsHeaders(request, env),
        },
      }
    );
  }
}
