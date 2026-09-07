const APPLICATION_TABLES = new Set([
  'users',
  'user_chats',
  'user_notes',
  'user_imported_problems',
  'user_progress',
  'activity_log',
  'concept_mastery',
  'daily_plan',
  'weekly_review',
  'feynman_logs',
  'user_artifacts',
  'user_drills',
  'record_sync_receipts',
  'user_projects',
  'user_learning_notes',
  'user_profile',
  'review_question_mastery',
  'user_elo_state',
  'user_imported_reviews',
  'user_push_subscriptions',
]);

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    current += character;

    if (quote) {
      if (character === quote && sql[index + 1] === quote) {
        current += sql[index + 1];
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === ';') {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function prepareD1Import(sourceSql) {
  const inserts = [];

  for (const statement of splitStatements(sourceSql)) {
    const match = statement.match(/^INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+([^\s(]+)/i);
    if (!match) continue;
    const table = match[1].replace(/^["'`[]|["'`\]]$/g, '');
    if (!APPLICATION_TABLES.has(table)) {
      throw new Error(`Unexpected source table in dump: ${table}`);
    }
    inserts.push(statement);
  }

  return {
    sql: ['PRAGMA defer_foreign_keys = true;', ...inserts, ''].join('\n'),
    statementCount: inserts.length,
  };
}
