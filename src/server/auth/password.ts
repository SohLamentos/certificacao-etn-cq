import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

const BANNED_PASSWORDS = new Set([
  'claro@123',
  'admin@123',
  'admin',
  'password',
  '123456',
  '12345678',
  'admin123',
  'root',
  'mudar123',
  'trocar123',
  'master@123',
]);

/**
 * Validates password complexity and rejects trivial/default credentials.
 */
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'A senha é obrigatória.' };
  }

  const trimmed = password.trim();

  if (trimmed.length < 8) {
    return { valid: false, reason: 'A senha deve possuir no mínimo 8 caracteres.' };
  }

  if (trimmed.length > 128) {
    return { valid: false, reason: 'A senha excede o tamanho máximo de 128 caracteres.' };
  }

  if (BANNED_PASSWORDS.has(trimmed.toLowerCase())) {
    return {
      valid: false,
      reason: 'A senha escolhida é trivial e está na lista de credenciais proibidas.',
    };
  }

  const hasUpper = /[A-Z]/.test(trimmed);
  const hasLower = /[a-z]/.test(trimmed);
  const hasNumber = /[0-9]/.test(trimmed);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(trimmed);

  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return {
      valid: false,
      reason:
        'A senha deve conter ao menos uma letra maiúscula, uma minúscula, um número e um caractere especial.',
    };
  }

  return { valid: true };
}

/**
 * Generates a secure salted hash for the provided password.
 * Plaintext passwords are never persisted.
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hash(plainText, BCRYPT_SALT_ROUNDS);
}

/**
 * Constant-time comparison between plaintext and password hash.
 */
export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  if (!plainText || !hash) {
    return false;
  }
  try {
    return await bcrypt.compare(plainText, hash);
  } catch (err) {
    console.error('[Auth] Error comparing password hash:', err);
    return false;
  }
}
