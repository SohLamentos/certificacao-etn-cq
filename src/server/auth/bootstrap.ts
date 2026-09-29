import { SafeUser } from './types';

export interface BootstrapResult {
  bootstrapped: boolean;
  message: string;
  adminUser?: SafeUser;
  error?: string;
}

/**
 * Bootstrap de Administrador Local — DESATIVADO SOB AUTH-2B.
 * 
 * Conforme especificação AUTH-2B da arquitetura ETN:
 * - A autoridade de identidade e credenciais é exclusivamente o ETN Materiais (etn-materiais-api).
 * - Nenhuma senha corporativa é persistida ou inicializada no banco de dados do Certificação CQ.
 * - Administradores e operadores autenticam-se com suas credenciais centrais do ETN Materiais
 *   e recebem autorização local via tabela cq_app_access / cq_app_roles.
 */
export async function bootstrapAdmin(): Promise<BootstrapResult> {
  // A criação de senhas locais foi desativada da arquitetura ativa
  return {
    bootstrapped: false,
    message: 'Local password bootstrap is deactivated under AUTH-2B ETN Identity Federation.',
  };
}
