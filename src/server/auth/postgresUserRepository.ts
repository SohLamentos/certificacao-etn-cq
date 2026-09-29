import { getPostgresPool, withPostgresTransaction } from '../db/postgres';
import { User, SafeUser } from './types';

export class PostgresUserRepository {
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

  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      login: row.login,
      name: row.name,
      password_hash: row.password_hash,
      role: row.role,
      status: row.status,
      must_change_password: Boolean(row.must_change_password),
      failed_login_attempts: Number(row.failed_login_attempts || 0),
      locked_until: row.locked_until ? new Date(row.locked_until).toISOString() : null,
      last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
      password_changed_at: row.password_changed_at ? new Date(row.password_changed_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  static async findByLogin(login: string): Promise<User | null> {
    const normalized = this.normalizeLogin(login);
    const pool = getPostgresPool();
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE LOWER(login) = LOWER($1) LIMIT 1',
      [normalized]
    );
    return rows.length > 0 ? this.mapRowToUser(rows[0]) : null;
  }

  static async findById(id: string): Promise<User | null> {
    const pool = getPostgresPool();
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return rows.length > 0 ? this.mapRowToUser(rows[0]) : null;
  }

  static async create(userData: {
    login: string;
    name: string;
    password_hash: string;
    role: User['role'];
    status?: User['status'];
    must_change_password?: boolean;
  }): Promise<User> {
    const normalizedLogin = this.normalizeLogin(userData.login);
    const pool = getPostgresPool();

    const sql = `
      INSERT INTO users (
        login, name, password_hash, role, status, must_change_password,
        failed_login_attempts, locked_until, last_login_at, password_changed_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        0, NULL, NULL, NULL,
        NOW(), NOW()
      )
      RETURNING *;
    `;

    try {
      const { rows } = await pool.query(sql, [
        normalizedLogin,
        userData.name.trim(),
        userData.password_hash,
        userData.role,
        userData.status || 'ACTIVE',
        userData.must_change_password !== undefined ? userData.must_change_password : true,
      ]);
      return this.mapRowToUser(rows[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        // Unique violation
        throw new Error(`User with login '${normalizedLogin}' already exists.`);
      }
      throw err;
    }
  }

  static async update(
    id: string,
    updates: Partial<Omit<User, 'id' | 'created_at'>>
  ): Promise<User | null> {
    const pool = getPostgresPool();
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'login' && typeof value === 'string') {
        fields.push(`login = $${paramIndex++}`);
        values.push(this.normalizeLogin(value));
      } else if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    try {
      const { rows } = await pool.query(sql, values);
      return rows.length > 0 ? this.mapRowToUser(rows[0]) : null;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new Error(`Login is already in use by another user.`);
      }
      throw err;
    }
  }

  /**
   * Concurrently-safe failed login increment with SELECT ... FOR UPDATE
   * to guarantee no lost updates during high-frequency concurrent login attempts.
   */
  static async recordFailedAttempt(
    userId: string,
    maxAttempts: number = 5,
    lockoutMinutes: number = 15
  ): Promise<{ failed_attempts: number; locked_until: string | null }> {
    return withPostgresTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT failed_login_attempts FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (rows.length === 0) {
        throw new Error('User not found');
      }

      const currentAttempts = Number(rows[0].failed_login_attempts || 0);
      const newAttempts = currentAttempts + 1;
      let lockedUntil: string | null = null;

      if (newAttempts >= maxAttempts) {
        lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString();
      }

      await client.query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE id = $3',
        [newAttempts, lockedUntil, userId]
      );

      return {
        failed_attempts: newAttempts,
        locked_until: lockedUntil,
      };
    });
  }

  /**
   * Concurrently-safe successful login normalization
   */
  static async recordSuccessfulLogin(userId: string): Promise<void> {
    const pool = getPostgresPool();
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
  }

  static async list(): Promise<User[]> {
    const pool = getPostgresPool();
    const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map((r) => this.mapRowToUser(r));
  }

  static async count(): Promise<number> {
    const pool = getPostgresPool();
    const { rows } = await pool.query('SELECT COUNT(*)::int as cnt FROM users');
    return rows[0].cnt;
  }
}
