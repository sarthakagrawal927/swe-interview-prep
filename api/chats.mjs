import { getDb } from './db/client.mjs';
import { requireAuth } from './auth/verify.mjs';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const db = getDb();

  // GET /api/chats?problemId=<id> - Get chat history for a problem
  if (req.method === 'GET') {
    const { problemId } = req.query;
    if (!problemId) {
      return res.status(400).json({ error: 'problemId required' });
    }

    const result = await db.execute({
      sql: 'SELECT messages FROM user_chats WHERE user_id = ? AND problem_id = ?',
      args: [user.id, problemId],
    });

    if (result.rows.length === 0) {
      return res.status(200).json({ messages: [] });
    }

    const messages = JSON.parse(result.rows[0].messages);
    return res.status(200).json({ messages });
  }

  // POST /api/chats - Save/update chat history
  if (req.method === 'POST') {
    const { problemId, messages } = req.body;
    if (!problemId || !messages) {
      return res.status(400).json({ error: 'problemId and messages required' });
    }

    // Check if chat exists
    const existing = await db.execute({
      sql: 'SELECT id FROM user_chats WHERE user_id = ? AND problem_id = ?',
      args: [user.id, problemId],
    });

    if (existing.rows.length > 0) {
      // Update
      await db.execute({
        sql: 'UPDATE user_chats SET messages = ?, updated_at = datetime("now") WHERE user_id = ? AND problem_id = ?',
        args: [JSON.stringify(messages), user.id, problemId],
      });
    } else {
      // Insert
      const id = randomBytes(16).toString('hex');
      await db.execute({
        sql: 'INSERT INTO user_chats (id, user_id, problem_id, messages) VALUES (?, ?, ?, ?)',
        args: [id, user.id, problemId, JSON.stringify(messages)],
      });
    }

    return res.status(200).json({ success: true });
  }

  // DELETE /api/chats?problemId=<id> - Clear chat history
  if (req.method === 'DELETE') {
    const { problemId } = req.query;
    if (!problemId) {
      return res.status(400).json({ error: 'problemId required' });
    }

    await db.execute({
      sql: 'DELETE FROM user_chats WHERE user_id = ? AND problem_id = ?',
      args: [user.id, problemId],
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
