import { getDb } from './db/client.mjs';
import { requireAuth } from './auth/verify.mjs';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const db = getDb();

  // GET /api/problems - Get all imported problems for user
  if (req.method === 'GET') {
    const result = await db.execute({
      sql: 'SELECT problem_id, problem_data FROM user_imported_problems WHERE user_id = ?',
      args: [user.id],
    });

    const problems = result.rows.map(row => ({
      problemId: row.problem_id,
      problemData: JSON.parse(row.problem_data),
    }));

    return res.status(200).json({ problems });
  }

  // POST /api/problems - Add/update imported problem
  if (req.method === 'POST') {
    const { problemId, problemData } = req.body;
    if (!problemId || !problemData) {
      return res.status(400).json({ error: 'problemId and problemData required' });
    }

    // Check if problem exists
    const existing = await db.execute({
      sql: 'SELECT id FROM user_imported_problems WHERE user_id = ? AND problem_id = ?',
      args: [user.id, problemId],
    });

    if (existing.rows.length > 0) {
      // Update
      await db.execute({
        sql: 'UPDATE user_imported_problems SET problem_data = ? WHERE user_id = ? AND problem_id = ?',
        args: [JSON.stringify(problemData), user.id, problemId],
      });
    } else {
      // Insert
      const id = randomBytes(16).toString('hex');
      await db.execute({
        sql: 'INSERT INTO user_imported_problems (id, user_id, problem_id, problem_data) VALUES (?, ?, ?, ?)',
        args: [id, user.id, problemId, JSON.stringify(problemData)],
      });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
