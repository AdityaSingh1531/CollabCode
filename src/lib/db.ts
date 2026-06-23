import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('WARNING: DATABASE_URL is not set. Database operations will fail.');
}

export const pool = new Pool({
  connectionString,
  // For production environments (like Render), we often need SSL enabled.
  // We can automatically enable it if DATABASE_URL contains 'render.com' or if NODE_ENV is production.
  ssl: connectionString?.includes('render.com') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// Flag to track if the database has been initialized
let isInitialized = false;

export async function initDb() {
  if (isInitialized) return;

  try {
    const client = await pool.connect();
    try {
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          hashed_password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          token UUID PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('Database tables successfully initialized.');
      isInitialized = true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    throw error;
  }
}
