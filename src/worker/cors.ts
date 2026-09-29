import { Env } from './types';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://etn-certificacao-cq.pages.dev',
  'https://etn-certificacao-cq.claro.com.br',
  'http://localhost:3000',
  'http://localhost:5173',
];

export function buildCorsHeaders(request: Request, env?: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  if (!origin) {
    return headers;
  }

  const originLower = origin.toLowerCase().replace(/\/$/, '');
  const customOrigins = (env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/\/$/, ''))
    .filter(Boolean);

  const allowedList = [...DEFAULT_ALLOWED_ORIGINS, ...customOrigins];

  const isAllowed =
    allowedList.includes(originLower) ||
    originLower.endsWith('.pages.dev') ||
    originLower.includes('localhost:') ||
    originLower.includes('127.0.0.1:');

  if (isAllowed) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }

  return headers;
}

export function handleCorsPreflight(request: Request, env?: Env): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request, env),
  });
}
