import { Env } from '../types';
import { buildCorsHeaders } from '../cors';

export async function handleHealth(request: Request, env: Env): Promise<Response> {
  let dbOk = false;
  try {
    if (env.DB) {
      const res = await env.DB.prepare('SELECT 1 as alive;').first<{ alive: number }>();
      dbOk = res?.alive === 1;
    }
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 200 : 503;
  const payload = {
    status: dbOk ? 'ok' : 'degraded',
    worker: true,
    db: dbOk,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(request, env),
    },
  });
}
