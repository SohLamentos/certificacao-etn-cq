export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[]; success: boolean; meta: any }>;
  run<T = unknown>(): Promise<{ success: boolean; meta: { changes: number } }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<any[]>;
  exec<T = unknown>(query: string): Promise<any>;
}

export interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  DB: D1Database;
  MAT_API: Fetcher;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
}

export type CqRole = 'ADMIN' | 'GESTOR' | 'ANALISTA' | 'CQ';

export interface EtnUser {
  id: string;
  name: string;
  login: string;
  role: string; // Papel central no ETN (ex: MULTIPLICADOR, TECNICO, etc.)
  status?: string;
}

export interface CqAppAccess {
  id: string;
  etn_user_id: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface CqContext {
  etnUser: EtnUser;
  access: CqAppAccess;
  roles: CqRole[];
  scopes: string[];
}
