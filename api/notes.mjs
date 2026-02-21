import { getDb } from './db/client.mjs';
import { requireAuth } from './auth/verify.mjs';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const db = getDb();

  // GET /api/notes?problemId=<id> - Get notes for a problem
  if (req.method === 'GET') {
    const { problemId } = req.query;
    if (!problemId) {
      return res.status(400).json({ error: 'problemId required' });
    }

    const result = await db.execute({
      sql: 'SELECT notes FROM user_notes WHERE user_id = ? AND problem_id = ?',
      args: [user.id, problemId],
    });

    if (result.rows.length === 0) {
      return res.status(200).json({ notes: '' });
    }

    return res.status(200).json({ notes: result.rows[0].notes });
  }

  // POST /api/notes - Save/update notes
  if (req.method === 'POST') {
    const { problemId, notes } = req.body;
    if (!problemId || notes === undefined) {
      return res.status(400).json({ error: 'problemId and notes required' });
    }

    // Check if notes exist
    const existing = await db.execute({
      sql: 'SELECT id FROM user_notes WHERE user_id = ? AND problem_id = ?',
      args: [user.id, problemId],
    });

    if (existing.rows.length > 0) {
      // Update
      await db.execute({
        sql: 'UPDATE user_notes SET notes = ?, updated_at = datetime("now") WHERE user_id = ? AND problem_id = ?',
        args: [notes, user.id, problemId],
      });
    } else {
      // Insert
      const id = randomBytes(16).toString('hex');
      await db.execute({
        sql: 'INSERT INTO user_notes (id, user_id, problem_id, notes) VALUES (?, ?, ?, ?)',
        args: [id, user.id, problemId, notes],
      });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
