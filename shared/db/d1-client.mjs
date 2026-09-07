/**
 * Adapt Cloudflare D1's prepared-statement API to the small libSQL-shaped
 * boundary used by the existing handlers.
 */
export function createD1Client(database) {
  if (!database || typeof database.prepare !== 'function') {
    throw new Error('Missing DB D1 binding');
  }

  return {
    async batch(statements) {
      const prepared = statements.map(({ sql, args = [] }) => database.prepare(sql).bind(...args));
      const results = await database.batch(prepared);
      return results.map((result) => ({
        rows: result.results ?? [],
        rowsAffected: result.meta?.changes ?? 0,
      }));
    },
    async execute(statement) {
      const sql = typeof statement === 'string' ? statement : statement?.sql;
      const args = typeof statement === 'string' ? [] : (statement?.args ?? []);

      if (typeof sql !== 'string' || sql.trim() === '') {
        throw new TypeError('Database statement must include SQL');
      }

      const prepared = database.prepare(sql);
      const bound = args.length > 0 ? prepared.bind(...args) : prepared;
      const result = await bound.all();

      return {
        rows: result.results ?? [],
        rowsAffected: result.meta?.changes ?? 0,
      };
    },
  };
}
