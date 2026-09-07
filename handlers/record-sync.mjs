export function recordAccountMatches(request, user) {
  const expected = new URL(request.url).searchParams.get('accountId');
  return !expected || expected === user.id;
}

/** Atomic receipts make a lost-response retry safe for counts and record data. */
export function recordSync(body, user) {
  if (body.accountId !== undefined && body.accountId !== user.id) {
    return { error: 'Account changed; retry from the original account', status: 409 };
  }
  const operationId = body.operationId;
  if (
    operationId !== undefined &&
    (typeof operationId !== 'string' || !/^[\w-]{1,128}$/.test(operationId))
  ) {
    return { error: 'Invalid operation ID', status: 400 };
  }
  if (operationId && body.accountId !== user.id) {
    return { error: 'Account ID required for synchronized writes', status: 400 };
  }
  const args = operationId ? [user.id, operationId] : [];
  return {
    args,
    guard: operationId
      ? 'NOT EXISTS (SELECT 1 FROM record_sync_receipts WHERE user_id = ? AND operation_id = ?)'
      : '1',
    async commit(db, statements) {
      if (!operationId) {
        for (const statement of statements) await db.execute(statement);
        return;
      }
      await db.batch([
        ...statements,
        {
          sql: 'INSERT OR IGNORE INTO record_sync_receipts (user_id, operation_id) VALUES (?, ?)',
          args,
        },
      ]);
    },
  };
}
