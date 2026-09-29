import { Env } from '../types';
import { requireCqAccess, requireCqRole } from '../auth/middleware';
import { buildCorsHeaders } from '../cors';

export async function handleAdminProbe(request: Request, env: Env): Promise<Response> {
  // 1. Exige identidade válida e acesso CQ habilitado
  const accessResult = await requireCqAccess(request, env);
  if (accessResult.success === false) {
    return accessResult.response;
  }

  const { context } = accessResult;

  // 2. Exige papel local de ADMIN
  const roleError = requireCqRole(request, env, context, ['ADMIN']);
  if (roleError) {
    return roleError;
  }

  // 3. Sucesso na verificação administrativa
  return new Response(
    JSON.stringify({
      status: 'ok',
      probe: 'ADMIN_ACCESS_VERIFIED',
      user: context.etnUser.login,
      roles: context.roles,
      timestamp: new Date().toISOString(),
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
