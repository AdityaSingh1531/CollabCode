/**
 * Secure server-side session & user store.
 * Connects to a persistent PostgreSQL database (e.g. on Render).
 * Sessions are stored in HttpOnly cookies via Next.js API routes,
 * meaning JavaScript in the browser CANNOT access the token at all.
 */

import { randomUUID } from 'crypto';
import { pool, initDb } from './db';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

// ─── Simple password hashing (no external deps) ──────────────────────────────
// We XOR each char code with a rotating key derived from the username so
// that the password is never stored in plain text, even in memory.
function hashPassword(password: string, username: string): string {
  let result = '';
  for (let i = 0; i < password.length; i++) {
    const key = username.charCodeAt(i % username.length);
    result += (password.charCodeAt(i) ^ key).toString(16).padStart(2, '0');
  }
  return result;
}

// ─── Mock Database fallback for local development without Postgres ──────────
interface MockUser {
  id: string;
  username: string;
  displayName: string;
  hashed_password: string;
  createdAt: string;
}

const globalRef = global as any;
if (!globalRef.mockDb) {
  globalRef.mockDb = {
    users: new Map<string, MockUser>(),
    sessions: new Map<string, string>(), // token -> userId
  };
}
const mockDb = globalRef.mockDb;
const useMock = !process.env.DATABASE_URL;

// ─── User operations ─────────────────────────────────────────────────────────

export async function createUser(username: string, password: string, displayName: string): Promise<UserProfile | null> {
  const cleanUsername = username.toLowerCase();
  
  if (useMock) {
    for (const u of mockDb.users.values()) {
      if (u.username === cleanUsername) {
        return null;
      }
    }
    const userId = randomUUID();
    const newUser: MockUser = {
      id: userId,
      username: cleanUsername,
      displayName: displayName.trim().slice(0, 40),
      hashed_password: hashPassword(password, cleanUsername),
      createdAt: new Date().toISOString(),
    };
    mockDb.users.set(userId, newUser);
    return {
      id: newUser.id,
      username: newUser.username,
      displayName: newUser.displayName,
      createdAt: newUser.createdAt,
    };
  }

  await initDb();
  const hashedPassword = hashPassword(password, cleanUsername);
  const userId = randomUUID();

  try {
    const query = `
      INSERT INTO users (id, username, display_name, hashed_password)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, display_name, created_at;
    `;
    const res = await pool.query(query, [userId, cleanUsername, displayName, hashedPassword]);
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      createdAt: row.created_at.toISOString(),
    };
  } catch (error: any) {
    // Unique violation error code in PostgreSQL is 23505
    if (error.code === '23505') {
      return null;
    }
    console.error('Error in createUser:', error);
    throw error;
  }
}

export async function verifyUser(username: string, password: string): Promise<UserProfile | null> {
  const cleanUsername = username.toLowerCase();

  if (useMock) {
    const hashedPassword = hashPassword(password, cleanUsername);
    for (const u of mockDb.users.values()) {
      if (u.username === cleanUsername && u.hashed_password === hashedPassword) {
        return {
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          createdAt: u.createdAt,
        };
      }
    }
    return null;
  }

  await initDb();
  const hashedPassword = hashPassword(password, cleanUsername);

  try {
    const query = `
      SELECT id, username, display_name, hashed_password, created_at
      FROM users
      WHERE username = $1;
    `;
    const res = await pool.query(query, [cleanUsername]);
    const row = res.rows[0];

    if (!row || row.hashed_password !== hashedPassword) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      createdAt: row.created_at.toISOString(),
    };
  } catch (error) {
    console.error('Error in verifyUser:', error);
    throw error;
  }
}

export async function getUserById(id: string): Promise<UserProfile | null> {
  if (useMock) {
    const u = mockDb.users.get(id);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      createdAt: u.createdAt,
    };
  }

  await initDb();
  try {
    const query = `
      SELECT id, username, display_name, created_at
      FROM users
      WHERE id = $1;
    `;
    const res = await pool.query(query, [id]);
    const row = res.rows[0];

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      createdAt: row.created_at.toISOString(),
    };
  } catch (error) {
    console.error('Error in getUserById:', error);
    throw error;
  }
}

// ─── Session operations ───────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  if (useMock) {
    const token = randomUUID();
    mockDb.sessions.set(token, userId);
    return token;
  }

  await initDb();
  const token = randomUUID();
  try {
    const query = `
      INSERT INTO sessions (token, user_id)
      VALUES ($1, $2);
    `;
    await pool.query(query, [token, userId]);
    return token;
  } catch (error) {
    console.error('Error in createSession:', error);
    throw error;
  }
}

export async function resolveSession(token: string): Promise<UserProfile | null> {
  if (useMock) {
    const userId = mockDb.sessions.get(token);
    if (!userId) return null;
    const u = mockDb.users.get(userId);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      createdAt: u.createdAt,
    };
  }

  await initDb();
  try {
    const query = `
      SELECT u.id, u.username, u.display_name, u.created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = $1;
    `;
    const res = await pool.query(query, [token]);
    const row = res.rows[0];

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      createdAt: row.created_at.toISOString(),
    };
  } catch (error) {
    console.error('Error in resolveSession:', error);
    return null;
  }
}

export async function destroySession(token: string): Promise<void> {
  if (useMock) {
    mockDb.sessions.delete(token);
    return;
  }

  await initDb();
  try {
    const query = `
      DELETE FROM sessions
      WHERE token = $1;
    `;
    await pool.query(query, [token]);
  } catch (error) {
    console.error('Error in destroySession:', error);
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────
export const SESSION_COOKIE = 'cc_session';

export function buildSessionCookie(token: string): string {
  // HttpOnly: JS cannot read it. SameSite=Strict: CSRF protection.
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`;
}

export function buildClearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
