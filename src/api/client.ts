/**
 * ETN Certificação CQ — Cliente HTTP Centralizado
 * Comunicação com o Cloudflare Worker produtivo (ou proxy de desenvolvimento)
 */

export interface EtnUser {
  id: string;
  name: string;
  login: string;
  role: string;
  status?: string;
}

export interface CQAccessData {
  id: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
  roles?: string[];
  scopes?: string[];
}

export interface LoginSuccessResponse {
  success: true;
  token: string;
  user: EtnUser;
  cq_access: CQAccessData;
}

export interface CqMeResponse {
  success: true;
  user: EtnUser;
  cq_access: CQAccessData;
  roles: string[];
  scopes: string[];
}

export interface AuthMeResponse {
  success: true;
  user: EtnUser;
}

export interface AdminProbeResponse {
  status: 'ok';
  probe: 'ADMIN_ACCESS_VERIFIED';
  user: string;
  roles: string[];
  timestamp: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  message?: string;
  raw?: any;
}

const TOKEN_STORAGE_KEY = 'etn_cq_auth_token';

// Guard para compatibilidade fora do bundler Vite (ex: suíte de testes Node.js)
if (typeof import.meta.env === 'undefined') {
  (import.meta as any).env = {};
}

// Fallback in-memory store for environments without sessionStorage (e.g. Node tests)
let memoryToken: string | null = null;
let testBaseUrlOverride: string | null = null;

/**
 * Permite configurar override de URL exclusivamente durante execução de testes
 */
export function setTestBaseUrl(url: string | null): void {
  testBaseUrlOverride = url;
}

/**
 * Normaliza e retorna a URL base da API
 */
export function getApiBaseUrl(): string {
  if (testBaseUrlOverride !== null) {
    if (!testBaseUrlOverride) {
      if (import.meta.env.DEV) {
        return '';
      }
      throw new Error('API_BASE_URL_NOT_CONFIGURED');
    }
    return testBaseUrlOverride.replace(/\/+$/, '');
  }

  // Acesso direto para que o Vite realize a substituição estática durante o build
  const rawUrl = import.meta.env.VITE_API_BASE_URL;
  const envUrl = rawUrl ? String(rawUrl).trim() : '';

  if (!envUrl) {
    // Permite fallback relativo apenas no ambiente local de desenvolvimento
    if (import.meta.env.DEV) {
      return '';
    }
    // Em produção ou build sem variável, fail-closed explícito
    throw new Error('API_BASE_URL_NOT_CONFIGURED');
  }

  // Remove trailing slashes para evitar //api/...
  return envUrl.replace(/\/+$/, '');
}

/**
 * Recupera o token de sessão do sessionStorage (ou fallback em memória)
 */
export function getToken(): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return memoryToken;
    }
  }
  return memoryToken;
}

/**
 * Salva o token de sessão no sessionStorage
 */
export function setToken(token: string): void {
  if (!token) return;
  memoryToken = token;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Storage cheio ou desabilitado
    }
  }
}

/**
 * Remove o token de sessão localmente
 */
export function clearToken(): void {
  memoryToken = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignorar erros no clear
    }
  }
}

/**
 * Função utilitária central para requisições HTTP seguras
 */
export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let baseUrl: string;
  try {
    baseUrl = getApiBaseUrl();
  } catch (err: any) {
    if (err?.message === 'API_BASE_URL_NOT_CONFIGURED') {
      return {
        ok: false,
        status: 500,
        error: 'API_BASE_URL_NOT_CONFIGURED',
        message: 'A URL da API de certificação não está configurada no ambiente.',
      };
    }
    throw err;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = path.startsWith('http') ? path : `${baseUrl}${normalizedPath}`;

  const headers = new Headers(options.headers || {});

  // Adiciona Content-Type caso não tenha sido explicitamente definido e haja body
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Injeta cabeçalho Authorization se o token estiver presente
  const currentToken = getToken();
  if (currentToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    let json: any = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: json?.error || (response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'FORBIDDEN' : 'API_ERROR'),
        message: json?.message || (response.status === 401 ? 'Credenciais inválidas ou sessão expirada.' : 'Erro na requisição.'),
        raw: json,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: json as T,
      raw: json,
    };
  } catch {
    // Fail-closed em erro de rede / timeout
    return {
      ok: false,
      status: 0,
      error: 'NETWORK_ERROR',
      message: 'Falha de comunicação com o servidor de certificação.',
    };
  }
}

/**
 * Métodos canônicos de autenticação e autorização
 */
export const apiClient = {
  getApiBaseUrl,
  setTestBaseUrl,
  getToken,
  setToken,
  clearToken,
  apiFetch,

  /**
   * Realiza login no backend homologado
   */
  async login(loginStr: string, passwordStr: string): Promise<ApiResponse<LoginSuccessResponse>> {
    const res = await apiFetch<LoginSuccessResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        login: loginStr.trim(),
        password: passwordStr,
      }),
    });

    // Se login retornou token válido, salva no sessionStorage
    if (res.ok && res.data?.token) {
      setToken(res.data.token);
    }

    return res;
  },

  /**
   * Consulta a identidade central do usuário autenticado (/api/auth/me)
   */
  async authMe(): Promise<ApiResponse<AuthMeResponse>> {
    return apiFetch<AuthMeResponse>('/api/auth/me', {
      method: 'GET',
    });
  },

  /**
   * Consulta os privilégios e papéis locais no Certificação CQ (/api/cq/me)
   */
  async cqMe(): Promise<ApiResponse<CqMeResponse>> {
    return apiFetch<CqMeResponse>('/api/cq/me', {
      method: 'GET',
    });
  },

  /**
   * Executa logout remoto na autoridade central e limpa o token local
   */
  async authLogout(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/api/auth/logout', {
        method: 'POST',
      });
      return res;
    } finally {
      clearToken();
    }
  },

  /**
   * Executa probe de privilégios de Administrador (/api/admin/probe)
   */
  async adminProbe(): Promise<ApiResponse<AdminProbeResponse>> {
    return apiFetch<AdminProbeResponse>('/api/admin/probe', {
      method: 'GET',
    });
  },
};
