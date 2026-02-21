import { getDb } from './client.mjs';
import { randomBytes } from 'crypto';

export async function findOrCreateUser({ googleId, email, name, picture }) {
  const db = getDb();

  // Try to find existing user
  const existing = await db.execute({
    sql: 'SELECT * FROM users WHERE google_id = ?',
    args: [googleId],
  });

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id,
      googleId: row.google_id,
      email: row.email,
      name: row.name,
      picture: row.picture,
      createdAt: row.created_at,
    };
  }

  // Create new user
  const id = randomBytes(16).toString('hex');
  await db.execute({
    sql: `INSERT INTO users (id, google_id, email, name, picture)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, googleId, email, name, picture || null],
  });

  return {
    id,
    googleId,
    email,
    name,
    picture: picture || null,
    createdAt: new Date().toISOString(),
  };
}

export async function getUserById(userId) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [userId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    createdAt: row.created_at,
  };
}
