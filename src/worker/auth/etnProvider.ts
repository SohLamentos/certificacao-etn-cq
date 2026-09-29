import { Env, EtnUser } from '../types';

export interface EtnLoginResult {
  success: boolean;
  status: number;
  user?: EtnUser;
  token?: string;
  error?: string;
  message?: string;
}

export interface EtnVerifyResult {
  success: boolean;
  status: number;
  user?: EtnUser;
  error?: string;
}

export class EtnIdentityProvider {
  /**
   * Autentica credencial de usuário na autoridade central de identidade (ETN Materiais)
   * عبر Service Binding nativo: env.MAT_API
   */
  static async login(
    env: Env,
    loginStr: string,
    passwordStr: string
  ): Promise<EtnLoginResult> {
    if (!env.MAT_API) {
      return {
        success: false,
        status: 502,
        error: 'ETN_AUTH_UNAVAILABLE',
        message: 'Serviço central de autenticação ETN indisponível.',
      };
    }

    try {
      const matReq = new Request('https://etn-materiais-api/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          login: loginStr,
          password: passwordStr,
        }),
      });

      const response = await env.MAT_API.fetch(matReq);
      const data = (await response.json().catch(() => ({}))) as any;

      if (!response.ok || !data.success) {
        return {
          success: false,
          status: response.status >= 500 ? 502 : response.status || 401,
          error: data.error || 'INVALID_CREDENTIALS',
          message: data.message || 'Credenciais inválidas no provedor central ETN.',
        };
      }

      const rawUser = data.user || data.data?.user;
      if (!rawUser || !rawUser.id) {
        return {
          success: false,
          status: 502,
          error: 'INVALID_ETN_RESPONSE',
          message: 'Resposta malformada da autoridade central ETN.',
        };
      }

      const user: EtnUser = {
        id: String(rawUser.id),
        name: String(rawUser.name || rawUser.login || 'Usuário ETN'),
        login: String(rawUser.login || ''),
        role: String(rawUser.role || ''),
        status: rawUser.status ? String(rawUser.status) : undefined,
      };

      const token = data.token || data.data?.token || '';

      return {
        success: true,
        status: 200,
        user,
        token,
      };
    } catch {
      // Fail-closed em caso de erro de rede ou timeout
      return {
        success: false,
        status: 502,
        error: 'ETN_AUTH_UNAVAILABLE',
        message: 'Falha de comunicação com o provedor central ETN (fail-closed).',
      };
    }
  }

  /**
   * Valida o token central Bearer contra a autoridade ETN Materiais (GET /api/auth/me)
   */
  static async validateToken(env: Env, token: string): Promise<EtnVerifyResult> {
    if (!token || !env.MAT_API) {
      return {
        success: false,
        status: env.MAT_API ? 401 : 502,
        error: env.MAT_API ? 'TOKEN_MISSING' : 'ETN_AUTH_UNAVAILABLE',
      };
    }

    try {
      const matReq = new Request('https://etn-materiais-api/api/auth/me', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const response = await env.MAT_API.fetch(matReq);
      if (!response.ok) {
        return {
          success: false,
          status: response.status >= 500 ? 502 : 401,
          error: 'TOKEN_INVALID_OR_EXPIRED',
        };
      }

      const data = (await response.json().catch(() => ({}))) as any;
      const rawUser = data.user || data.data?.user;

      if (!rawUser || !rawUser.id) {
        return {
          success: false,
          status: 401,
          error: 'TOKEN_IDENTITY_NOT_FOUND',
        };
      }

      const user: EtnUser = {
        id: String(rawUser.id),
        name: String(rawUser.name || rawUser.login || 'Usuário ETN'),
        login: String(rawUser.login || ''),
        role: String(rawUser.role || ''),
        status: rawUser.status ? String(rawUser.status) : undefined,
      };

      return {
        success: true,
        status: 200,
        user,
      };
    } catch {
      // Fail-closed
      return {
        success: false,
        status: 502,
        error: 'ETN_AUTH_UNAVAILABLE',
      };
    }
  }

  /**
   * Encaminha o logout para a autoridade ETN revogar o token
   */
  static async logout(env: Env, token: string): Promise<boolean> {
    if (!token || !env.MAT_API) return true;
    try {
      const matReq = new Request('https://etn-materiais-api/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      await env.MAT_API.fetch(matReq);
      return true;
    } catch {
      return false;
    }
  }
}
