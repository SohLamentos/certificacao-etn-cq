import { Env } from '../types';
import { requireCqAccess } from '../auth/middleware';
import { buildCorsHeaders } from '../cors';

export async function handleCqMe(request: Request, env: Env): Promise<Response> {
  const result = await requireCqAccess(request, env);
  if (result.success === false) {
    return result.response;
  }

  const { context } = result;

  // Retorna somente dados sanitizados e estritamente necessários
  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: context.etnUser.id,
        name: context.etnUser.name,
        login: context.etnUser.login,
        role: context.etnUser.role,
      },
      cq_access: {
        id: context.access.id,
        enabled: true,
        created_at: context.access.created_at,
        updated_at: context.access.updated_at,
      },
      roles: context.roles,
      scopes: context.scopes,
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
