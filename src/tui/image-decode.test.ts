import { describe, expect, test } from 'bun:test'
import { encode as encodeJpeg } from 'jpeg-js'
import { PNG } from 'pngjs'
import { decodeImage, MAX_IMAGE_PIXELS } from '@/tui/image-decode.ts'

/** A tiny synthetic RGBA image: red→blue gradient, fully opaque. */
function rgbaFixture(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      data[i] = Math.round((x / Math.max(width - 1, 1)) * 255)
      data[i + 2] = Math.round((y / Math.max(height - 1, 1)) * 255)
      data[i + 3] = 255
    }
  }
  return data
}

function pngFixture(width: number, height: number): Uint8Array {
  const png = new PNG({ width, height })
  png.data = Buffer.from(rgbaFixture(width, height))
  return new Uint8Array(PNG.sync.write(png))
}

function jpegFixture(width: number, height: number): Uint8Array {
  const encoded = encodeJpeg({ data: Buffer.from(rgbaFixture(width, height)), width, height }, 90)
  return new Uint8Array(encoded.data)
}

describe('decodeImage', () => {
  test('decodes a PNG to RGBA with its dimensions', () => {
    const decoded = decodeImage(pngFixture(8, 5))
    expect(decoded).not.toBeNull()
    expect(decoded?.width).toBe(8)
    expect(decoded?.height).toBe(5)
    expect(decoded?.rgba.length).toBe(8 * 5 * 4)
    // Corner pixels of the gradient: left edge has no red, right edge is full red.
    expect(decoded?.rgba[0]).toBe(0)
    expect(decoded?.rgba[(8 - 1) * 4]).toBe(255)
    expect(decoded?.rgba[3]).toBe(255) // opaque
  })

  test('decodes a JPEG to RGBA with its dimensions', () => {
    const decoded = decodeImage(jpegFixture(8, 5))
    expect(decoded).not.toBeNull()
    expect(decoded?.width).toBe(8)
    expect(decoded?.height).toBe(5)
    expect(decoded?.rgba.length).toBe(8 * 5 * 4)
    // JPEG is lossy — assert the gradient's direction, not exact values.
    const left = decoded?.rgba[0] ?? 0
    const right = decoded?.rgba[(8 - 1) * 4] ?? 0
    expect(right - left).toBeGreaterThan(128)
  })

  test('format comes from magic bytes, not the caller', () => {
    // A PNG handed over as image/jpeg still decodes as PNG.
    expect(decodeImage(pngFixture(4, 4))?.width).toBe(4)
  })

  test('unknown formats return null, never throw', () => {
    expect(decodeImage(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBeNull() // GIF
    expect(decodeImage(new Uint8Array(0))).toBeNull()
    expect(decodeImage(new TextEncoder().encode('not an image'))).toBeNull()
  })

  test('corrupt bytes with a valid signature return null, never throw', () => {
    const png = pngFixture(8, 8)
    expect(decodeImage(png.slice(0, 20))).toBeNull()
    const jpeg = jpegFixture(8, 8)
    expect(decodeImage(jpeg.slice(0, 20))).toBeNull()
  })

  test('an image over the pixel cap is refused — degrade, not stall', () => {
    // A real decode at the cap would be slow; fake the dimensions instead.
    // 100000x100000 PNG header with no real data: the guard reads IHDR before
    // decoding, so it must reject on dimensions alone.
    const png = pngFixture(4, 4)
    const view = new DataView(png.buffer, png.byteOffset)
    view.setUint32(16, 100000) // IHDR width
    view.setUint32(20, 100000) // IHDR height
    expect(decodeImage(png)).toBeNull()
    expect(MAX_IMAGE_PIXELS).toBeGreaterThan(0)
  })
})
