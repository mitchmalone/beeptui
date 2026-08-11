import type { Database } from 'bun:sqlite'

/**
 * Forward-only schema migrations for the local UI store. Each entry upgrades the
 * DB by one version; `runMigrations` applies any not yet applied inside a
 * transaction and bumps `schema_meta.version`. Never edit a shipped migration —
 * append a new one.
 *
 * The store holds ONLY non-authoritative UI state (drafts, last-view, chat
 * metadata cache). There is deliberately no table for message bodies or tokens
 * (CLAUDE.md invariant 1).
 */
export type Migration = (db: Database) => void

export const MIGRATIONS: Migration[] = [
  // v1 — initial schema.
  (db) => {
    db.run(
      `CREATE TABLE drafts (
         chat_id    TEXT PRIMARY KEY,
         text       TEXT NOT NULL,
         updated_at INTEGER NOT NULL
       )`
    )
    db.run(
      `CREATE TABLE view_state (
         id                       INTEGER PRIMARY KEY CHECK (id = 1),
         last_selected_chat_id    TEXT,
         scroll_anchor_message_id TEXT
       )`
    )
    db.run(
      `CREATE TABLE chat_cache (
         id            TEXT PRIMARY KEY,
         account_id    TEXT NOT NULL,
         network       TEXT NOT NULL,
         title         TEXT NOT NULL,
         type          TEXT NOT NULL,
         unread_count  INTEGER NOT NULL,
         is_archived   INTEGER NOT NULL,
         is_muted      INTEGER NOT NULL,
         last_activity TEXT
       )`
    )
  },
]

/** The schema version the current code expects. */
export function currentVersion(migrations: Migration[] = MIGRATIONS): number {
  return migrations.length
}

/**
 * Apply pending migrations. Idempotent: safe to call on every open. Returns the
 * resulting schema version.
 */
export function runMigrations(db: Database, migrations: Migration[] = MIGRATIONS): number {
  db.run(`CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL)`)
  const row = db.query(`SELECT version FROM schema_meta LIMIT 1`).get() as {
    version: number
  } | null
  if (row === null) db.run(`INSERT INTO schema_meta (version) VALUES (0)`)
  let version = row?.version ?? 0

  for (let i = version; i < migrations.length; i++) {
    const migrate = migrations[i]
    // A hole in the migration list means the upgrade path is corrupt — refuse
    // rather than skip a version and claim it ran.
    if (migrate === undefined) throw new Error(`Missing migration for schema version ${i + 1}`)
    const apply = db.transaction(() => {
      migrate(db)
      db.query(`UPDATE schema_meta SET version = ?`).run(i + 1)
    })
    apply()
    version = i + 1
  }
  return version
}
