import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { currentVersion, MIGRATIONS, runMigrations, type Migration } from '@/store/schema.ts'

function memoryDb(): Database {
  return new Database(':memory:')
}

describe('runMigrations', () => {
  test('applies all real migrations from scratch and reports the version', () => {
    const db = memoryDb()
    expect(runMigrations(db)).toBe(currentVersion())
    const tables = (
      db.query(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{ name: string }>
    ).map((r) => r.name)
    expect(tables).toContain('drafts')
    expect(tables).toContain('chat_cache')
    db.close()
  })

  test('is idempotent — a second run applies nothing', () => {
    const db = memoryDb()
    runMigrations(db)
    expect(runMigrations(db)).toBe(currentVersion()) // no throw, no double-create
    db.close()
  })

  test('forward-migrates an older DB, preserving existing data', () => {
    const db = memoryDb()
    // Start at v1 (initial schema only).
    const v1: Migration[] = [MIGRATIONS[0]!]
    expect(runMigrations(db, v1)).toBe(1)
    db.query(`INSERT INTO drafts (chat_id, text, updated_at) VALUES (?, ?, ?)`).run('c1', 'old', 1)

    // A later release adds a column.
    const v2: Migration[] = [
      MIGRATIONS[0]!,
      (d) => d.run(`ALTER TABLE drafts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`),
    ]
    expect(runMigrations(db, v2)).toBe(2)

    // Existing data survived; the new column exists with its default.
    const row = db.query(`SELECT text, pinned FROM drafts WHERE chat_id = 'c1'`).get() as {
      text: string
      pinned: number
    }
    expect(row).toEqual({ text: 'old', pinned: 0 })
    db.close()
  })
})
