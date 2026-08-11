import { describe, expect, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { PNG } from 'pngjs'
import { ImagePreviewCache } from '@/tui/image-preview-cache.ts'
import { ImageSliceRenderable } from '@/tui/components/ImageSlice.tsx'

function solidPng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const png = new PNG({ width, height })
  for (let i = 0; i < width * height; i += 1) {
    png.data[i * 4] = rgb[0]
    png.data[i * 4 + 1] = rgb[1]
    png.data[i * 4 + 2] = rgb[2]
    png.data[i * 4 + 3] = 255
  }
  return new Uint8Array(PNG.sync.write(png))
}

async function readyCache(bytes: Uint8Array): Promise<ImagePreviewCache> {
  const cache = new ImagePreviewCache({
    download: async () => ({ localPath: '/synthetic' }),
    readFile: async () => bytes,
  })
  const settled = new Promise<void>((resolve) => {
    const unsub = cache.subscribe(() => {
      unsub()
      resolve()
    })
  })
  cache.get('a', 20, 4)
  await settled
  return cache
}

describe('ImageSliceRenderable paint', () => {
  // The native supersample draw has no horizontal bound of its own — without
  // the scissor it samples wrapped garbage out to the buffer edge (the bug the
  // first live demo run surfaced). This paints one slice and asserts both the
  // painted cells and the emptiness beyond them.
  test('paints its band inside the image rectangle and nothing outside it', async () => {
    // Solid red, 40x40 → square image in a 20x4 block: fit = 8x4 cells.
    const cache = await readyCache(solidPng(40, 40, [255, 0, 0]))
    const { renderer, renderOnce, captureSpans } = await createTestRenderer({
      width: 30,
      height: 3,
    })
    const slice = new ImageSliceRenderable(renderer, {
      attachmentId: 'a',
      slice: 1,
      of: 4,
      blockCols: 20,
      cache,
      width: 30,
      height: 1,
      position: 'absolute',
      left: 2,
      top: 1,
    })
    renderer.root.add(slice)
    await renderOnce()

    const spans = captureSpans().lines[1]?.spans ?? []
    // One painted run of 8 cells at x=2 — red on both halves — then nothing.
    const painted = spans.filter((s) => s.text.includes('█'))
    expect(painted).toHaveLength(1)
    expect(painted[0]?.text).toBe('████████')
    const fg = [...(painted[0]?.fg.buffer ?? [])]
    expect(fg.slice(0, 3)).toEqual([255, 0, 0])
    // Rows above/below the slice's own row stay untouched.
    const otherRows = [0, 2].map((row) => captureSpans().lines[row]?.spans ?? [])
    for (const row of otherRows) {
      expect(row.every((s) => !s.text.includes('█'))).toBe(true)
    }
    renderer.destroy()
  })

  test('draws nothing when the entry is not ready', async () => {
    const cache = new ImagePreviewCache({
      download: async () => {
        throw new Error('offline')
      },
    })
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({
      width: 20,
      height: 2,
    })
    const slice = new ImageSliceRenderable(renderer, {
      attachmentId: 'a',
      slice: 0,
      of: 4,
      blockCols: 10,
      cache,
      width: 20,
      height: 1,
    })
    renderer.root.add(slice)
    await renderOnce()
    expect(captureCharFrame().trim()).toBe('')
    renderer.destroy()
  })
})
