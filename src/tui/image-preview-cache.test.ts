import { describe, expect, test } from 'bun:test'
import { PNG } from 'pngjs'
import { ImagePreviewCache } from '@/tui/image-preview-cache.ts'

function pngBytes(width: number, height: number): Uint8Array {
  const png = new PNG({ width, height })
  png.data = Buffer.from(new Uint8Array(width * height * 4).fill(200))
  return new Uint8Array(PNG.sync.write(png))
}

/** A cache whose "download" resolves to synthetic PNG bytes. */
function cacheWith(over: {
  bytes?: Uint8Array
  download?: (id: string) => Promise<{ localPath: string }>
  concurrency?: number
  capacity?: number
  maxFileBytes?: number
  gate?: Promise<void>
}) {
  const bytes = over.bytes ?? pngBytes(40, 40)
  return new ImagePreviewCache({
    download: over.download ?? (async () => ({ localPath: '/synthetic/fixture' })),
    readFile: async () => {
      if (over.gate !== undefined) await over.gate
      return bytes
    },
    ...(over.concurrency !== undefined ? { concurrency: over.concurrency } : {}),
    ...(over.capacity !== undefined ? { capacity: over.capacity } : {}),
    ...(over.maxFileBytes !== undefined ? { maxFileBytes: over.maxFileBytes } : {}),
  })
}

function settled(cache: ImagePreviewCache): Promise<void> {
  return new Promise((resolve) => {
    const unsub = cache.subscribe(() => {
      unsub()
      resolve()
    })
  })
}

describe('ImagePreviewCache', () => {
  test('first ask is loading; the pipeline lands a ready entry with scaled pixels', async () => {
    const cache = cacheWith({})
    const done = settled(cache)
    expect(cache.get('a', 20, 8)).toEqual({ status: 'loading' })
    await done
    const entry = cache.get('a', 20, 8)
    expect(entry.status).toBe('ready')
    if (entry.status === 'ready') {
      expect(entry.rows).toBe(8)
      expect(entry.cols).toBe(16) // square image: 2 × rows
      expect(entry.rgba.length).toBe(16 * 2 * 8 * 2 * 4)
    }
  })

  test('a failed download parks the entry as failed — no throw, no retry loop', async () => {
    let calls = 0
    const cache = cacheWith({
      download: async () => {
        calls += 1
        throw new Error('offline')
      },
    })
    const done = settled(cache)
    cache.get('a', 20, 8)
    await done
    expect(cache.get('a', 20, 8)).toEqual({ status: 'failed' })
    expect(cache.get('a', 20, 8)).toEqual({ status: 'failed' })
    expect(calls).toBe(1)
  })

  test('undecodable bytes fail honestly', async () => {
    const cache = cacheWith({ bytes: new TextEncoder().encode('not an image') })
    const done = settled(cache)
    cache.get('a', 20, 8)
    await done
    expect(cache.get('a', 20, 8).status).toBe('failed')
  })

  test('an oversized file is refused before decode', async () => {
    const cache = cacheWith({ bytes: pngBytes(40, 40), maxFileBytes: 10 })
    const done = settled(cache)
    cache.get('a', 20, 8)
    await done
    expect(cache.get('a', 20, 8).status).toBe('failed')
  })

  test('different block geometries are separate entries (resize)', async () => {
    const cache = cacheWith({})
    const first = settled(cache)
    cache.get('a', 20, 8)
    await first
    const second = settled(cache)
    expect(cache.get('a', 30, 8).status).toBe('loading')
    await second
    expect(cache.get('a', 30, 8).status).toBe('ready')
    expect(cache.get('a', 20, 8).status).toBe('ready') // still cached
  })

  test('the cache is LRU-capped', async () => {
    const cache = cacheWith({ capacity: 2 })
    for (const id of ['a', 'b', 'c']) {
      const done = settled(cache)
      cache.get(id, 10, 4)
      await done
    }
    expect(cache.get('b', 10, 4).status).toBe('ready')
    expect(cache.get('c', 10, 4).status).toBe('ready')
    // 'a' was evicted: asking again restarts the pipeline.
    expect(cache.get('a', 10, 4).status).toBe('loading')
  })

  test('in-flight pipelines are bounded', async () => {
    let inFlight = 0
    let peak = 0
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    const cache = new ImagePreviewCache({
      download: async (id) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await gate
        inFlight -= 1
        return { localPath: `/synthetic/${id.length}` }
      },
      readFile: async () => pngBytes(4, 4),
      concurrency: 2,
    })
    for (const id of ['a', 'b', 'c', 'd']) cache.get(id, 10, 4)
    await new Promise((r) => setTimeout(r, 10))
    expect(peak).toBe(2)
    release()
    await new Promise((r) => setTimeout(r, 10))
    expect(cache.get('d', 10, 4).status).toBe('ready')
  })
})

describe('default file reader', () => {
  // The real adapter returns `srcURL` from Beeper — a file:// URL on current
  // desktop builds. The first live run rendered every block as a parked
  // placeholder because the default reader passed the URL to Bun.file verbatim.
  test('reads a file:// URL the same as a plain path', async () => {
    const path = `${process.env.TMPDIR ?? '/tmp'}/beeptui-test-preview-${process.pid}.png`
    await Bun.write(path, pngBytes(12, 12))
    try {
      const cache = new ImagePreviewCache({
        download: async () => ({ localPath: `file://${path}` }),
      })
      const settled = new Promise<void>((resolve) => {
        const unsub = cache.subscribe(() => {
          unsub()
          resolve()
        })
      })
      cache.get('a', 10, 4)
      await settled
      expect(cache.get('a', 10, 4).status).toBe('ready')
    } finally {
      await Bun.file(path).delete()
    }
  })
})
