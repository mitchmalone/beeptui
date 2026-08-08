import { decode as decodeJpeg } from 'jpeg-js'
import { PNG } from 'pngjs'

/**
 * Attachment bytes → RGBA pixels for the cell painter. PNG and JPEG only —
 * the formats bridges actually send (DECISIONS 2026-08-07); anything else
 * returns null and the caller keeps the text placeholder (invariant 8).
 *
 * The format is sniffed from magic bytes, never from the reported MIME type —
 * bridges mislabel, and a wrong decoder throwing is exactly the failure this
 * module exists to contain: no input, however corrupt, makes it throw.
 */

export interface DecodedImage {
  rgba: Uint8Array
  width: number
  height: number
}

/** Refuse to decode anything larger than this many pixels (width × height).
 *  A 24 MP photo decodes to ~96 MB of RGBA and takes long enough to stall the
 *  UI; the thumbnail it becomes needs none of that fidelity. Oversized images
 *  degrade to the placeholder. */
export const MAX_IMAGE_PIXELS = 16_000_000

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b)
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8
}

/** PNG dimensions straight from the IHDR chunk, so the pixel cap can refuse
 *  an oversized image without decoding it. Null if the header is truncated. */
function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

export function decodeImage(bytes: Uint8Array): DecodedImage | null {
  try {
    if (isPng(bytes)) {
      const dims = pngDimensions(bytes)
      if (dims === null || dims.width * dims.height > MAX_IMAGE_PIXELS) return null
      const png = PNG.sync.read(Buffer.from(bytes))
      return { rgba: new Uint8Array(png.data), width: png.width, height: png.height }
    }
    if (isJpeg(bytes)) {
      const jpeg = decodeJpeg(bytes, {
        useTArray: true,
        maxMemoryUsageInMB: 512,
        maxResolutionInMP: Math.floor(MAX_IMAGE_PIXELS / 1_000_000),
      })
      return { rgba: new Uint8Array(jpeg.data), width: jpeg.width, height: jpeg.height }
    }
  } catch {
    // Corrupt or hostile bytes: the placeholder is the honest output.
  }
  return null
}
