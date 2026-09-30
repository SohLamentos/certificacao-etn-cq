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

// Fallback in-memory store for environments without sessionStorage (e.g. Node tests)
let memoryToken: string | null = null;

/**
 * Normaliza e retorna a URL base da API
 */
export function getApiBaseUrl(): string {
  // Em Vite, variáveis de build client-side iniciam com VITE_
  const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
  const envUrl = meta?.env?.VITE_API_BASE_URL
    ? String(meta.env.VITE_API_BASE_URL).trim()
    : '';

  if (!envUrl) {
    return '';
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
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${baseUrl}${normalizedPath}`;

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
