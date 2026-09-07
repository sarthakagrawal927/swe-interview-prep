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
      sql: 'SELECT * FROM user_projects WHERE user_id = ?',
      args: [user.id],
    });
    const projects = {};
    for (const row of r.rows) {
      projects[row.project_id] = {
        status: row.status,
        nextAction: row.next_action || '',
        milestones: row.milestones_json ? JSON.parse(row.milestones_json) : {},
        updatedAt: row.updated_at,
      };
    }
    return json({ projects });
  }

  if (request.method === 'POST') {
    const body = await readJsonBody(request);
    const sync = recordSync(body, user);
    if (sync.error) return json({ error: sync.error }, { status: sync.status });
    const { projectId, status, nextAction, milestones } = body;
    if (!projectId) return json({ error: 'projectId required' }, { status: 400 });
    const write = {
      sql: `INSERT INTO user_projects (id, user_id, project_id, status, next_action, milestones_json)
            SELECT ?, ?, ?, ?, ?, ? WHERE ${sync.guard}
            ON CONFLICT(user_id, project_id) DO UPDATE SET
              status = excluded.status,
              next_action = excluded.next_action,
              milestones_json = excluded.milestones_json,
              updated_at = datetime('now')`,
      args: [
        randomBytes(16).toString('hex'),
        user.id,
        projectId,
        status || 'planned',
        nextAction || null,
        milestones ? JSON.stringify(milestones) : null,
        ...sync.args,
      ],
    };
    await sync.commit(db, [write]);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}
