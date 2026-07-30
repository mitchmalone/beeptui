import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { homedir } from 'node:os'
import type { ChatSummary } from '@/beeper/types.ts'
import { MIGRATIONS, runMigrations, type Migration } from '@/store/schema.ts'

export interface ViewState {
  lastSelectedChatId: string | null
  scrollAnchorMessageId: string | null
}

/**
 * The local UI store — the only module that opens SQLite (CLAUDE.md invariant 1).
 * A narrow, synchronous, typed interface over one database. Writes are committed
 * immediately, so a crash loses at most whatever the caller hasn't flushed yet.
 */
export interface UiStore {
  /** All persisted drafts as `chatId → text`. */
  getDrafts(): Record<string, string>
  /** Upsert a draft. Empty text deletes it (drafts are never blank rows). */
  setDraft(chatId: string, text: string): void
  getViewState(): ViewState
  setViewState(view: ViewState): void
  /** Cached chat summaries for a fast inbox paint before the first live fetch. */
  getCachedChats(): ChatSummary[]
  /** Write-through the current chat summaries into the cache. */
  putCachedChats(chats: ChatSummary[]): void
  close(): void
}

export interface OpenOptions {
  /** DB path; defaults to the platform state dir. Use `:memory:` or a temp file
   *  in tests. */
  path?: string
  /** Injectable clock for deterministic `updated_at`. */
  now?: () => number
  /** Injectable migration list (tests exercise the runner). */
  migrations?: Migration[]
}

/** Default DB location: `$XDG_STATE_HOME/beeper-tui/ui.db` (or `~/.local/state`). */
export function defaultDbPath(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const stateHome = env.XDG_STATE_HOME ?? `${home}/.local/state`
  return `${stateHome}/beeper-tui/ui.db`
}

interface CachedChatRow {
  id: string
  account_id: string
  network: string
  title: string
  type: string
  unread_count: number
  is_archived: number
  is_muted: number
  last_activity: string | null
}

export function openUiStore(options: OpenOptions = {}): UiStore {
  const path = options.path ?? defaultDbPath()
  const now = options.now ?? (() => Date.now())
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const db = new Database(path)
  db.run('PRAGMA journal_mode = WAL')
  runMigrations(db, options.migrations ?? MIGRATIONS)

  return {
    getDrafts() {
      const rows = db.query(`SELECT chat_id, text FROM drafts`).all() as Array<{
        chat_id: string
        text: string
      }>
      const drafts: Record<string, string> = {}
      for (const row of rows) drafts[row.chat_id] = row.text
      return drafts
    },

    setDraft(chatId, text) {
      if (text.length === 0) {
        db.query(`DELETE FROM drafts WHERE chat_id = ?`).run(chatId)
        return
      }
      db.query(
        `INSERT INTO drafts (chat_id, text, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`
      ).run(chatId, text, now())
    },

    getViewState() {
      const row = db
        .query(
          `SELECT last_selected_chat_id, scroll_anchor_message_id FROM view_state WHERE id = 1`
        )
        .get() as {
        last_selected_chat_id: string | null
        scroll_anchor_message_id: string | null
      } | null
      return {
        lastSelectedChatId: row?.last_selected_chat_id ?? null,
        scrollAnchorMessageId: row?.scroll_anchor_message_id ?? null,
      }
    },

    setViewState(view) {
      db.query(
        `INSERT INTO view_state (id, last_selected_chat_id, scroll_anchor_message_id)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           last_selected_chat_id = excluded.last_selected_chat_id,
           scroll_anchor_message_id = excluded.scroll_anchor_message_id`
      ).run(view.lastSelectedChatId, view.scrollAnchorMessageId)
    },

    getCachedChats() {
      const rows = db
        .query(`SELECT * FROM chat_cache ORDER BY last_activity DESC`)
        .all() as CachedChatRow[]
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        network: row.network,
        title: row.title,
        type: row.type === 'group' ? 'group' : 'single',
        unreadCount: row.unread_count,
        isArchived: row.is_archived === 1,
        isMuted: row.is_muted === 1,
        ...(row.last_activity !== null ? { lastActivity: row.last_activity } : {}),
      }))
    },

    putCachedChats(chats) {
      const upsert = db.query(
        `INSERT INTO chat_cache
           (id, account_id, network, title, type, unread_count, is_archived, is_muted, last_activity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           account_id = excluded.account_id, network = excluded.network, title = excluded.title,
           type = excluded.type, unread_count = excluded.unread_count,
           is_archived = excluded.is_archived, is_muted = excluded.is_muted,
           last_activity = excluded.last_activity`
      )
      const writeAll = db.transaction((items: ChatSummary[]) => {
        for (const c of items) {
          upsert.run(
            c.id,
            c.accountId,
            c.network,
            c.title,
            c.type,
            c.unreadCount,
            c.isArchived ? 1 : 0,
            c.isMuted ? 1 : 0,
            c.lastActivity ?? null
          )
        }
      })
      writeAll(chats)
    },

    close() {
      db.close()
    },
  }
}
