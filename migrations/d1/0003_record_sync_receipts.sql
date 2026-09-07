CREATE TABLE IF NOT EXISTS record_sync_receipts (
  user_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, operation_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
