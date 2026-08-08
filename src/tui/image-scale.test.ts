import { describe, expect, test } from 'bun:test'
import { fitToBlock, scaleRgba } from '@/tui/image-scale.ts'

describe('fitToBlock', () => {
  // Cell geometry: a block is cols×rows cells; the supersample grid is 2 px
  // per cell on each axis, and a drawn cell is visually ~half as wide as it
  // is tall — so a square image should use cols ≈ 2 × aspect × rows.
  test('a square image fills the block height and half-ish the width', () => {
    const fit = fitToBlock({ width: 400, height: 400 }, 60, 8)
    expect(fit.rows).toBe(8)
    expect(fit.cols).toBe(16) // 2 aspect(1) rows
  })

  test('a wide image is capped by the block width and letterboxes vertically', () => {
    const fit = fitToBlock({ width: 4000, height: 400 }, 40, 8)
    expect(fit.cols).toBe(40)
    expect(fit.rows).toBe(2) // 40 / (2 × 10)
  })

  test('a tall image fills the height at a narrow width', () => {
    const fit = fitToBlock({ width: 200, height: 800 }, 60, 8)
    expect(fit.rows).toBe(8)
    expect(fit.cols).toBe(4)
  })

  test('degenerate inputs never produce a zero or negative fit', () => {
    expect(fitToBlock({ width: 1, height: 10000 }, 60, 8).cols).toBeGreaterThan(0)
    expect(fitToBlock({ width: 10000, height: 1 }, 60, 8).rows).toBeGreaterThan(0)
    const tiny = fitToBlock({ width: 100, height: 100 }, 1, 1)
    expect(tiny.cols).toBe(1)
    expect(tiny.rows).toBe(1)
  })
})

describe('scaleRgba', () => {
  test('box-filters down to the requested size', () => {
    // 4x4 source: left half solid red, right half solid blue → 2x2 out.
    const src = new Uint8Array(4 * 4 * 4)
    for (let y = 0; y < 4; y += 1)
      for (let x = 0; x < 4; x += 1) {
        const i = (y * 4 + x) * 4
        src[i] = x < 2 ? 255 : 0
        src[i + 2] = x < 2 ? 0 : 255
        src[i + 3] = 255
      }
    const out = scaleRgba(src, 4, 4, 2, 2)
    expect(out.length).toBe(2 * 2 * 4)
    expect(out[0]).toBe(255) // top-left red
    expect(out[2]).toBe(0)
    expect(out[4]).toBe(0) // top-right blue
    expect(out[6]).toBe(255)
    expect(out[3]).toBe(255) // opaque
  })

  test('averages across the source box, not point-samples', () => {
    // 2x1 source: pure red + pure blue → 1x1 out must be the average of both.
    const src = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255])
    const out = scaleRgba(src, 2, 1, 1, 1)
    expect(out[0]).toBeGreaterThan(100)
    expect(out[2]).toBeGreaterThan(100)
  })

  test('upscales a smaller source without holes', () => {
    const src = new Uint8Array([10, 20, 30, 255])
    const out = scaleRgba(src, 1, 1, 3, 2)
    expect(out.length).toBe(3 * 2 * 4)
    for (let px = 0; px < 6; px += 1) {
      expect(out[px * 4]).toBe(10)
      expect(out[px * 4 + 3]).toBe(255)
    }
  })
})
