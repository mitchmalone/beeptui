/**
 * Fetch-decode-scale pipeline and cache for inline image previews.
 *
 * The renderable asks `get(attachmentId, blockCols, blockRows)` synchronously
 * every frame; the first ask kicks off the async pipeline (download via the
 * adapter → read the local file → decode → scale to the block's supersample
 * grid) and the entry stays `loading` until it lands. Subscribers are told
 * when any entry changes so the view can request a repaint.
 *
 * Honesty rules (invariant 8): failures park the entry as `failed` — the
 * placeholder stays forever, nothing retries in a loop. Bytes and paths are
 * never logged (invariant 6). Memory is bounded (invariant: bounded memory):
 * scaled pixels only, LRU-capped; decoded source pixels are dropped as soon
 * as the scale is done.
 */

import { decodeImage } from '@/tui/image-decode.ts'
import { fitToBlock, scaleRgba } from '@/tui/image-scale.ts'

export type PreviewEntry =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready'
      /** RGBA on the supersample grid: (2·cols) × (2·rows) pixels. */
      rgba: Uint8Array
      /** Cells the image uses inside the block (≤ requested block size). */
      cols: number
      rows: number
    }

interface PreviewIo {
  /** `Gateway.downloadAttachment` — returns a local file path. */
  download(attachmentId: string): Promise<{ localPath: string }>
  /** Read a local file; default `Bun.file(...).bytes()`. */
  readFile?(path: string): Promise<Uint8Array>
  /** Max in-flight download+decode pipelines. */
  concurrency?: number
  /** Max cached entries (scaled thumbnails are ~10s of KB each). */
  capacity?: number
  /** Refuse files larger than this many bytes before decoding. */
  maxFileBytes?: number
}

const DEFAULT_CONCURRENCY = 2
const DEFAULT_CAPACITY = 64
const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024

export class ImagePreviewCache {
  #io: Required<PreviewIo>
  /** Keyed by `${attachmentId}@${blockCols}x${blockRows}` — a resize changes
   *  the target grid, so each geometry is its own entry (LRU keeps it sane). */
  #entries = new Map<string, PreviewEntry>()
  #queue: Array<() => Promise<void>> = []
  #inFlight = 0
  #listeners = new Set<() => void>()
  #version = 0

  constructor(io: PreviewIo) {
    this.#io = {
      download: io.download,
      readFile: io.readFile ?? (async (path) => new Uint8Array(await Bun.file(path).bytes())),
      concurrency: io.concurrency ?? DEFAULT_CONCURRENCY,
      capacity: io.capacity ?? DEFAULT_CAPACITY,
      maxFileBytes: io.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
    }
  }

  /** Current entry for this attachment at this block geometry, starting the
   *  pipeline on first ask. Synchronous — safe to call from a render pass. */
  get(attachmentId: string, blockCols: number, blockRows: number): PreviewEntry {
    const key = `${attachmentId}@${blockCols}x${blockRows}`
    const existing = this.#entries.get(key)
    if (existing !== undefined) {
      // LRU touch: re-insert at the tail.
      this.#entries.delete(key)
      this.#entries.set(key, existing)
      return existing
    }
    const entry: PreviewEntry = { status: 'loading' }
    this.#store(key, entry)
    this.#enqueue(async () => {
      this.#store(key, await this.#produce(attachmentId, blockCols, blockRows))
      this.#notify()
    })
    return entry
  }

  /** Monotonic change counter — pairs with `subscribe` for
   *  `useSyncExternalStore`, and doubles as a dirty-marker prop. */
  get version(): number {
    return this.#version
  }

  /** Re-render hook; returns unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async #produce(
    attachmentId: string,
    blockCols: number,
    blockRows: number
  ): Promise<PreviewEntry> {
    try {
      const { localPath } = await this.#io.download(attachmentId)
      const bytes = await this.#io.readFile(localPath)
      if (bytes.byteLength > this.#io.maxFileBytes) return { status: 'failed' }
      const decoded = decodeImage(bytes)
      if (decoded === null) return { status: 'failed' }
      const fit = fitToBlock(decoded, blockCols, blockRows)
      const rgba = scaleRgba(
        decoded.rgba,
        decoded.width,
        decoded.height,
        fit.cols * 2,
        fit.rows * 2
      )
      return { status: 'ready', rgba, cols: fit.cols, rows: fit.rows }
    } catch {
      // Download/read failed. The entry parks as failed; the placeholder is
      // the honest output and nothing spins on retries.
      return { status: 'failed' }
    }
  }

  #store(key: string, entry: PreviewEntry): void {
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    while (this.#entries.size > this.#io.capacity) {
      const oldest = this.#entries.keys().next().value
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }
  }

  #enqueue(job: () => Promise<void>): void {
    this.#queue.push(job)
    void this.#drain()
  }

  async #drain(): Promise<void> {
    if (this.#inFlight >= this.#io.concurrency) return
    const job = this.#queue.shift()
    if (job === undefined) return
    this.#inFlight += 1
    try {
      await job()
    } finally {
      this.#inFlight -= 1
      void this.#drain()
    }
  }

  #notify(): void {
    this.#version += 1
    for (const listener of this.#listeners) listener()
  }
}
