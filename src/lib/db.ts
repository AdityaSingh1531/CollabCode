import { Pool } from 'pg';

/**
 * Lazy singleton Pool — only instantiated on first use at runtime.
 *
 * WHY: Next.js statically imports all server modules during `npm run build`.
 * If we call `new Pool()` at the top level, it runs during the build step
 * where DATABASE_URL is not available (Render injects it only at runtime via
 * `fromDatabase`). That causes a silent build crash with no logs.
 *
 * By deferring construction to `getPool()`, the Pool is only created when a
 * request actually hits an API route — i.e. at runtime, when the env var exists.
 */

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. ' +
      'For local dev, add it to .env. ' +
      'On Render it is injected automatically at runtime.'
    );
  }

  _pool = new Pool({
    connectionString,
    // Render Postgres URLs include "render.com"; also enable SSL in production.
    ssl:
      connectionString.includes('render.com') || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  });

  return _pool;
}

// Keep a named export `pool` for backward-compat with existing imports,
// but now it's a Proxy that lazily resolves to the real Pool on first access.
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getPool() as any)[prop];
  },
});

// Flag to track if the database schema has been initialized this process lifetime
let isInitialized = false;

export async function initDb() {
  if (isInitialized) return;

  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_chats (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        cell_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY,
        chat_id UUID NOT NULL REFERENCES user_chats(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database tables successfully initialized.');
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    throw error;
  } finally {
    client.release();
  }
}
