import crypto from 'node:crypto';
import { loadDatabase, saveDatabase } from '../db/store';
import { PostgresUserRepository } from './postgresUserRepository';
import { User, SafeUser } from './types';

function isPostgres(): boolean {
  return process.env.DB_DRIVER === 'postgres';
}

export class UserRepository {
  static normalizeLogin(login: string): string {
    return login.trim().toLowerCase();
  }

  static toSafeUser(user: User): SafeUser {
    const { password_hash, ...safe } = user;
    return {
      ...safe,
      etn_user_id: user.id,
      roles: [user.role],
    };
  }

  static async findByLogin(login: string): Promise<User | null> {
    if (isPostgres()) {
      return PostgresUserRepository.findByLogin(login);
    }
    const normalized = this.normalizeLogin(login);
    const db = loadDatabase();
    const user = db.users.find((u) => this.normalizeLogin(u.login) === normalized);
    return user ? { ...user } : null;
  }

  static async findById(id: string): Promise<User | null> {
    if (isPostgres()) {
      return PostgresUserRepository.findById(id);
    }
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === id);
    return user ? { ...user } : null;
  }

  static async create(userData: {
    login: string;
    name: string;
    password_hash: string;
    role: User['role'];
    status?: User['status'];
    must_change_password?: boolean;
  }): Promise<User> {
    if (isPostgres()) {
      return PostgresUserRepository.create(userData);
    }

    const normalizedLogin = this.normalizeLogin(userData.login);
    const db = loadDatabase();

    const exists = db.users.some((u) => this.normalizeLogin(u.login) === normalizedLogin);
    if (exists) {
      throw new Error(`User with login '${normalizedLogin}' already exists.`);
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      login: normalizedLogin,
      name: userData.name.trim(),
      password_hash: userData.password_hash,
      role: userData.role,
      status: userData.status || 'ACTIVE',
      must_change_password: userData.must_change_password !== undefined ? userData.must_change_password : true,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
      password_changed_at: null,
      created_at: now,
      updated_at: now,
    };

    db.users.push(newUser);
    saveDatabase(db);
    return { ...newUser };
  }

  static async update(id: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User | null> {
    if (isPostgres()) {
      return PostgresUserRepository.update(id, updates);
    }

    const db = loadDatabase();
    const index = db.users.findIndex((u) => u.id === id);
    if (index === -1) {
      return null;
    }

    const current = db.users[index];
    if (updates.login) {
      const normalizedNewLogin = this.normalizeLogin(updates.login);
      const duplicate = db.users.some(
        (u) => u.id !== id && this.normalizeLogin(u.login) === normalizedNewLogin
      );
      if (duplicate) {
        throw new Error(`Login '${normalizedNewLogin}' is already in use by another user.`);
      }
      updates.login = normalizedNewLogin;
    }

    const updatedUser: User = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    db.users[index] = updatedUser;
    saveDatabase(db);
    return { ...updatedUser };
  }

  /**
   * Concurrently safe failed login increment.
   * Uses SELECT ... FOR UPDATE in Postgres or in-memory update in JSON mode.
   */
  static async recordFailedAttempt(
    userId: string,
    maxAttempts: number = 5,
    lockoutMinutes: number = 15
  ): Promise<{ failed_attempts: number; locked_until: string | null }> {
    if (isPostgres()) {
      return PostgresUserRepository.recordFailedAttempt(userId, maxAttempts, lockoutMinutes);
    }

    const db = loadDatabase();
    const index = db.users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error('User not found');
    }

    const user = db.users[index];
    const newAttempts = (user.failed_login_attempts || 0) + 1;
    let lockedUntil: string | null = null;

    if (newAttempts >= maxAttempts) {
      lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString();
    }

    user.failed_login_attempts = newAttempts;
    user.locked_until = lockedUntil;
    user.updated_at = new Date().toISOString();
    saveDatabase(db);

    return {
      failed_attempts: newAttempts,
      locked_until: lockedUntil,
    };
  }

  /**
   * Concurrently safe successful login normalization.
   */
  static async recordSuccessfulLogin(userId: string): Promise<void> {
    if (isPostgres()) {
      return PostgresUserRepository.recordSuccessfulLogin(userId);
    }

    const db = loadDatabase();
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      user.failed_login_attempts = 0;
      user.locked_until = null;
      user.last_login_at = new Date().toISOString();
      user.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  }

  static async list(): Promise<User[]> {
    if (isPostgres()) {
      return PostgresUserRepository.list();
    }
    const db = loadDatabase();
    return db.users.map((u) => ({ ...u }));
  }

  static async count(): Promise<number> {
    if (isPostgres()) {
      return PostgresUserRepository.count();
    }
    const db = loadDatabase();
    return db.users.length;
  }
}
