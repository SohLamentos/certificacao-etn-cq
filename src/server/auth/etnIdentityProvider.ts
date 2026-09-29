/**
 * ETN Identity Provider (Auth Adapter)
 * 
 * Centraliza a comunicação com a autoridade canônica de autenticação ETN (etn-materiais-api).
 * O restante da aplicação Certificação CQ nunca manipula URLs, endpoints ou peculiaridades
 * internas da autoridade central.
 * 
 * CONTRATO REAL UTILIZADO (comprovado na Auditoria 1B):
 * - POST /api/auth/login -> { token, tokenType: 'Bearer', user: { id, login, displayName, role, ... } }
 * - GET /api/auth/me    -> { id, login, displayName, role, ... }
 * - POST /api/auth/logout -> { message: '...' }
 */

export interface EtnCredentials {
  login: string;
  password?: string;
}

export interface EtnIdentityUser {
  id: string; // Canonical user UUID in ETN Materiais (D1 users.id)
  login: string;
  displayName: string;
  role: string; // Central role: ADMIN | MANAGER | ANALYST | MULTIPLIER
  status?: string;
  groupId?: string;
  groupIds?: string[];
  groupCodes?: string[];
  primaryGroupCode?: string;
  allowedGroupCodes?: string[];
  permissions?: string[];
}

export interface EtnAuthResult {
  success: boolean;
  token?: string;
  tokenType?: string;
  expiresAt?: string;
  user?: EtnIdentityUser;
  error?: {
    code: string;
    message: string;
  };
  statusCode: number;
}

export type EtnMockHandler = (credentials: EtnCredentials) => Promise<EtnAuthResult>;

export class EtnIdentityProvider {
  private static mockHandler: EtnMockHandler | null = null;

  /**
   * Configura um mock provider controlado exclusivamente para testes unitários ou ambientes de CI.
   */
  public static setMockHandler(handler: EtnMockHandler | null): void {
    this.mockHandler = handler;
  }

  /**
   * Retorna a URL base configurada para a API do ETN Materiais.
   */
  public static getBaseUrl(): string {
    const raw =
      process.env.ETN_MATERIAIS_AUTH_URL ||
      'https://etn-materiais-api.persistentesoficial365.workers.dev';
    return raw.trim().replace(/\/+$/, '');
  }

  /**
   * Executa a autenticação das credenciais fornecidas contra a autoridade central.
   * NUNCA loga a senha ou a armazena.
   */
  public static async login(credentials: EtnCredentials): Promise<EtnAuthResult> {
    // 1. Mock provider prioritário (para testes automatizados herméticos)
    if (this.mockHandler) {
      return this.mockHandler(credentials);
    }

    if (!credentials.login || typeof credentials.login !== 'string' || !credentials.login.trim()) {
      return {
        success: false,
        statusCode: 400,
        error: { code: 'VALIDATION_ERROR', message: 'O campo login é obrigatório.' },
      };
    }

    if (!credentials.password || typeof credentials.password !== 'string') {
      return {
        success: false,
        statusCode: 400,
        error: { code: 'PASSWORD_REQUIRED', message: 'A senha é obrigatória.' },
      };
    }

    const normalizedLogin = credentials.login.trim().toLowerCase();

    // 2. Produção Cloudflare Worker (Interface preparada para Service Binding MAT_API)
    // Quando rodando dentro do runtime Cloudflare Worker, o binding global MAT_API é utilizado
    const globalBinding = (globalThis as any).MAT_API;
    if (globalBinding && typeof globalBinding.fetch === 'function') {
      try {
        const upstreamRes = await globalBinding.fetch('https://etn-materiais-api/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ login: normalizedLogin, password: credentials.password }),
        });
        return await this.parseLoginResponse(upstreamRes);
      } catch {
        return {
          success: false,
          statusCode: 502,
          error: {
            code: 'UPSTREAM_GATEWAY_ERROR',
            message: 'Autoridade central de autenticação ETN (via Service Binding) indisponível.',
          },
        };
      }
    }

    // 3. Fallback Node.js / Google AI Studio: Chamada HTTPS externa para o endpoint canônico
    const baseUrl = this.getBaseUrl();
    const endpoint = baseUrl.endsWith('/api') ? `${baseUrl}/auth/login` : `${baseUrl}/api/auth/login`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          login: normalizedLogin,
          password: credentials.password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.parseLoginResponse(response);
    } catch {
      // FAIL-CLOSED: NUNCA logar senha, login ou token
      return {
        success: false,
        statusCode: 502,
        error: {
          code: 'UPSTREAM_GATEWAY_ERROR',
          message: 'Autoridade central de autenticação ETN temporariamente indisponível.',
        },
      };
    }
  }

  /**
   * Valida um Bearer token contra o endpoint canônico /api/auth/me do Materiais.
   */
  public static async validateIdentity(token: string): Promise<EtnIdentityUser | null> {
    if (!token || typeof token !== 'string') return null;

    // Mock handler fallback para testes
    if (this.mockHandler) {
      if (token.startsWith('etn-mock-token-')) {
        const parts = token.split('-');
        const role = parts[3]?.toUpperCase() || 'CQ';
        const id = parts[4] || 'usr-mock';
        return {
          id,
          login: `user.${role.toLowerCase()}`,
          displayName: `Usuário Mock ${role}`,
          role,
        };
      }
    }

    const globalBinding = (globalThis as any).MAT_API;
    if (globalBinding && typeof globalBinding.fetch === 'function') {
      try {
        const res = await globalBinding.fetch('https://etn-materiais-api/api/auth/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Accept': 'application/json',
          },
        });
        return await this.parseMeResponse(res);
      } catch {
        return null;
      }
    }

    const baseUrl = this.getBaseUrl();
    const endpoint = baseUrl.endsWith('/api') ? `${baseUrl}/auth/me` : `${baseUrl}/api/auth/me`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token.trim()}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.parseMeResponse(response);
    } catch {
      return null;
    }
  }

  /**
   * Encaminha logout/revogação de sessão para o ETN Materiais.
   */
  public static async logout(token: string): Promise<void> {
    if (!token) return;

    const globalBinding = (globalThis as any).MAT_API;
    if (globalBinding && typeof globalBinding.fetch === 'function') {
      try {
        await globalBinding.fetch('https://etn-materiais-api/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Content-Type': 'application/json',
          },
        });
      } catch {
        // Silencioso em caso de falha de rede externa
      }
      return;
    }

    const baseUrl = this.getBaseUrl();
    const endpoint = baseUrl.endsWith('/api') ? `${baseUrl}/auth/logout` : `${baseUrl}/api/auth/logout`;

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.trim()}`,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // Silencioso
    }
  }

  private static async parseLoginResponse(response: Response): Promise<EtnAuthResult> {
    const status = response.status;
    let data: any = null;

    try {
      data = await response.json();
    } catch {
      return {
        success: false,
        statusCode: 502,
        error: { code: 'INVALID_UPSTREAM_RESPONSE', message: 'Resposta da autoridade central não é um JSON válido.' },
      };
    }

    if (!response.ok) {
      const errorMsg =
        data?.error?.message ||
        data?.message ||
        (typeof data?.error === 'string' ? data.error : 'Credenciais inválidas ou usuário inativo.');
      const errorCode = data?.error?.code || 'INVALID_CREDENTIALS';

      return {
        success: false,
        statusCode: status,
        error: { code: errorCode, message: errorMsg },
      };
    }

    // Envelope canônico do Materiais: { success: true, data: { token, tokenType, expiresAt, user } }
    const payload = data?.data && typeof data.data === 'object' ? data.data : data;
    const token = payload?.token;
    const rawUser = payload?.user;

    if (!token || !rawUser || !rawUser.id) {
      return {
        success: false,
        statusCode: 502,
        error: { code: 'INVALID_UPSTREAM_RESPONSE', message: 'Resposta da autoridade central sem token ou identidade.' },
      };
    }

    const user: EtnIdentityUser = {
      id: String(rawUser.id).trim(),
      login: String(rawUser.login || rawUser.id).trim().toLowerCase(),
      displayName: String(rawUser.displayName || rawUser.display_name || rawUser.name || rawUser.login || 'Usuário').trim(),
      role: String(rawUser.role || 'ANALYST').toUpperCase(),
      status: rawUser.status,
      groupId: rawUser.groupId,
      groupIds: Array.isArray(rawUser.groupIds) ? rawUser.groupIds : undefined,
      groupCodes: Array.isArray(rawUser.groupCodes) ? rawUser.groupCodes : undefined,
      primaryGroupCode: rawUser.primaryGroupCode,
      allowedGroupCodes: Array.isArray(rawUser.allowedGroupCodes) ? rawUser.allowedGroupCodes : undefined,
      permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : undefined,
    };

    return {
      success: true,
      statusCode: 200,
      token,
      tokenType: payload?.tokenType || 'Bearer',
      expiresAt: payload?.expiresAt,
      user,
    };
  }

  private static async parseMeResponse(response: Response): Promise<EtnIdentityUser | null> {
    if (!response.ok) return null;

    try {
      const data = await response.json();
      const rawUser = data?.data && typeof data.data === 'object' ? data.data : (data?.user || data);
      if (!rawUser || !rawUser.id) return null;

      return {
        id: String(rawUser.id).trim(),
        login: String(rawUser.login || rawUser.id).trim().toLowerCase(),
        displayName: String(rawUser.displayName || rawUser.display_name || rawUser.name || 'Usuário').trim(),
        role: String(rawUser.role || 'ANALYST').toUpperCase(),
        status: rawUser.status,
        groupId: rawUser.groupId,
        groupIds: Array.isArray(rawUser.groupIds) ? rawUser.groupIds : undefined,
        groupCodes: Array.isArray(rawUser.groupCodes) ? rawUser.groupCodes : undefined,
        primaryGroupCode: rawUser.primaryGroupCode,
        allowedGroupCodes: Array.isArray(rawUser.allowedGroupCodes) ? rawUser.allowedGroupCodes : undefined,
        permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : undefined,
      };
    } catch {
      return null;
    }
  }
}
