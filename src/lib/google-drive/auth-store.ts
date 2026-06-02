import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";
import type { Credentials } from "google-auth-library";

export type GoogleUserProfile = {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
};

export type AuthStatus = {
  connected: boolean;
  user: GoogleUserProfile | null;
  expiresAt?: string;
};

export interface GoogleAuthStore {
  upsertUserTokens(user: GoogleUserProfile, tokens: Credentials): Promise<void>;
  readTokensForUser(userId: string): Promise<Credentials | null>;
  createSession(userId: string, expiresAt: Date): Promise<AuthSession>;
  readSession(sessionId: string): Promise<AuthSession | null>;
  readUser(userId: string): Promise<GoogleUserProfile | null>;
  deleteSession(sessionId: string): Promise<void>;
}

type FileAuthData = {
  users: Record<string, GoogleUserProfile>;
  tokens: Record<string, Credentials>;
  sessions: Record<string, AuthSession>;
};

export function createGoogleAuthStore(): GoogleAuthStore {
  if (process.env.DATABASE_URL) {
    return new PostgresGoogleAuthStore(process.env.DATABASE_URL);
  }

  return new FileGoogleAuthStore();
}

export class FileGoogleAuthStore implements GoogleAuthStore {
  constructor(
    private readonly authFilePath = process.env.GOOGLE_AUTH_FILE ??
      path.join(process.cwd(), "data", "tokens", "google-auth.json")
  ) {}

  async upsertUserTokens(user: GoogleUserProfile, tokens: Credentials): Promise<void> {
    const data = await this.readData();
    const existing = data.tokens[user.id];
    data.users[user.id] = user;
    data.tokens[user.id] = {
      ...existing,
      ...tokens,
      refresh_token: tokens.refresh_token ?? existing?.refresh_token
    };
    await this.writeData(data);
  }

  async readTokensForUser(userId: string): Promise<Credentials | null> {
    const data = await this.readData();
    return data.tokens[userId] ?? null;
  }

  async createSession(userId: string, expiresAt: Date): Promise<AuthSession> {
    const data = await this.readData();
    const session = {
      id: `sess_${crypto.randomUUID()}`,
      userId,
      expiresAt: expiresAt.toISOString()
    };
    data.sessions[session.id] = session;
    await this.writeData(data);
    return session;
  }

  async readSession(sessionId: string): Promise<AuthSession | null> {
    const data = await this.readData();
    const session = data.sessions[sessionId];
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      delete data.sessions[sessionId];
      await this.writeData(data);
      return null;
    }
    return session;
  }

  async readUser(userId: string): Promise<GoogleUserProfile | null> {
    const data = await this.readData();
    return data.users[userId] ?? null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const data = await this.readData();
    delete data.sessions[sessionId];
    await this.writeData(data);
  }

  private async readData(): Promise<FileAuthData> {
    try {
      const raw = await readFile(this.authFilePath, "utf8");
      return normalizeFileAuthData(JSON.parse(raw) as unknown);
    } catch (error) {
      if (isMissingFileError(error)) {
        return { users: {}, tokens: {}, sessions: {} };
      }
      throw error;
    }
  }

  private async writeData(data: FileAuthData): Promise<void> {
    await mkdir(path.dirname(this.authFilePath), { recursive: true });
    await writeFile(this.authFilePath, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
  }
}

export class PostgresGoogleAuthStore implements GoogleAuthStore {
  private readonly pool: Pool;
  private initialized: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });
  }

  async upsertUserTokens(user: GoogleUserProfile, tokens: Credentials): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `
        insert into deepen_users (id, email, name, picture, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (id) do update set
          email = excluded.email,
          name = excluded.name,
          picture = excluded.picture,
          updated_at = now()
      `,
      [user.id, user.email, user.name ?? null, user.picture ?? null]
    );

    const existing = await this.readTokensForUser(user.id);
    const merged = {
      ...existing,
      ...tokens,
      refresh_token: tokens.refresh_token ?? existing?.refresh_token
    };

    await this.pool.query(
      `
        insert into deepen_google_tokens (user_id, tokens, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (user_id) do update set
          tokens = excluded.tokens,
          updated_at = now()
      `,
      [user.id, JSON.stringify(merged)]
    );
  }

  async readTokensForUser(userId: string): Promise<Credentials | null> {
    await this.ensureSchema();
    const result = await this.pool.query<{ tokens: Credentials }>(
      "select tokens from deepen_google_tokens where user_id = $1",
      [userId]
    );
    return result.rows[0]?.tokens ?? null;
  }

  async createSession(userId: string, expiresAt: Date): Promise<AuthSession> {
    await this.ensureSchema();
    const session = {
      id: `sess_${crypto.randomUUID()}`,
      userId,
      expiresAt: expiresAt.toISOString()
    };
    await this.pool.query(
      "insert into deepen_sessions (id, user_id, expires_at) values ($1, $2, $3)",
      [session.id, session.userId, session.expiresAt]
    );
    return session;
  }

  async readSession(sessionId: string): Promise<AuthSession | null> {
    await this.ensureSchema();
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      expires_at: Date;
    }>(
      "select id, user_id, expires_at from deepen_sessions where id = $1 and expires_at > now()",
      [sessionId]
    );
    const session = result.rows[0];
    if (!session) return null;
    return {
      id: session.id,
      userId: session.user_id,
      expiresAt: session.expires_at.toISOString()
    };
  }

  async readUser(userId: string): Promise<GoogleUserProfile | null> {
    await this.ensureSchema();
    const result = await this.pool.query<GoogleUserProfile>(
      "select id, email, name, picture from deepen_users where id = $1",
      [userId]
    );
    return result.rows[0] ?? null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query("delete from deepen_sessions where id = $1", [sessionId]);
  }

  private ensureSchema(): Promise<void> {
    this.initialized ??= this.pool.query(`
      create table if not exists deepen_users (
        id text primary key,
        email text not null,
        name text,
        picture text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists deepen_google_tokens (
        user_id text primary key references deepen_users(id) on delete cascade,
        tokens jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists deepen_sessions (
        id text primary key,
        user_id text not null references deepen_users(id) on delete cascade,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null
      );
    `).then(() => undefined);

    return this.initialized;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function normalizeFileAuthData(value: unknown): FileAuthData {
  if (!isRecord(value)) {
    return { users: {}, tokens: {}, sessions: {} };
  }

  return {
    users: isRecord(value.users) ? (value.users as Record<string, GoogleUserProfile>) : {},
    tokens: isRecord(value.tokens) ? (value.tokens as Record<string, Credentials>) : {},
    sessions: isRecord(value.sessions) ? (value.sessions as Record<string, AuthSession>) : {}
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
