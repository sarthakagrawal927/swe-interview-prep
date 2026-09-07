import { recordAccountMatches, recordSync } from './record-sync.mjs';
import { randomBytes } from 'node:crypto';

import { readJsonBody } from '../shared/api/read-json.mjs';
import { getDb } from '../shared/db/client.mjs';
import { initDatabase } from '../shared/db/schema.mjs';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initDatabase();
    initialized = true;
  }
}

export default async function handler({ request, user, json }) {
  await ensureInit();
  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
  if (!recordAccountMatches(request, user))
    return json({ error: 'Account changed' }, { status: 409 });
  const db = getDb();

  if (request.method === 'GET') {
    const r = await db.execute({
      sql: 'SELECT * FROM user_drills WHERE user_id = ?',
      args: [user.id],
    });
    const drills = {};
    for (const row of r.rows) {
      drills[row.drill_id] = {
        status: row.status,
        attempts: row.attempts,
        lastCode: row.last_code || '',
        lastAttempt: row.last_attempt,
        updatedAt: row.updated_at,
      };
    }
    return json({ drills });
  }

  if (request.method === 'POST') {
    const body = await readJsonBody(request);
    const sync = recordSync(body, user);
    if (sync.error) return json({ error: sync.error }, { status: sync.status });
    const { drillId, status, lastCode } = body;
    if (!drillId) return json({ error: 'drillId required' }, { status: 400 });
    const now = new Date().toISOString();
    // attempts increments on every save; status reflects the latest outcome.
    const write = {
      sql: `INSERT INTO user_drills (id, user_id, drill_id, status, attempts, last_code, last_attempt)
            SELECT ?, ?, ?, ?, 1, ?, ? WHERE ${sync.guard}
            ON CONFLICT(user_id, drill_id) DO UPDATE SET
              status = excluded.status,
              attempts = user_drills.attempts + 1,
              last_code = excluded.last_code,
              last_attempt = excluded.last_attempt,
              updated_at = datetime('now')`,
      args: [
        randomBytes(16).toString('hex'),
        user.id,
        drillId,
        status || 'attempted',
        lastCode || null,
        now,
        ...sync.args,
      ],
    };
    // Mirror the attempt into the activity log for personalization.
    const activity = {
      sql: `INSERT INTO activity_log (id, user_id, kind, payload)
            SELECT ?, ?, 'drill', ? WHERE ${sync.guard}`,
      args: [
        randomBytes(16).toString('hex'),
        user.id,
        JSON.stringify({ drillId, status: status || 'attempted' }),
        ...sync.args,
      ],
    };
    await sync.commit(db, [write, activity]);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}
