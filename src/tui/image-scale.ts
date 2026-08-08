/**
 * Pure pixel maths for the inline-image painter: fit an image into a block of
 * cells, and box-filter RGBA down (or up) to the supersample grid. No I/O.
 *
 * Geometry: `drawSuperSampleBuffer` consumes 2 px per cell on each axis
 * (verified against the test renderer), and a terminal cell displays roughly
 * twice as tall as wide — so preserving the image's visual aspect means
 * cols ≈ 2 × aspect × rows.
 */

export interface BlockFit {
  /** Cells the image actually uses inside the block (≤ the block's size). */
  cols: number
  rows: number
}

/** Visual cell aspect: a cell is about twice as tall as it is wide. */
const CELL_HEIGHT_TO_WIDTH = 2

export function fitToBlock(
  image: { width: number; height: number },
  blockCols: number,
  blockRows: number
): BlockFit {
  const aspect = Math.max(image.width, 1) / Math.max(image.height, 1)
  // Fill the block height; derive the cols that keep the visual aspect.
  let rows = Math.max(blockRows, 1)
  let cols = Math.round(aspect * CELL_HEIGHT_TO_WIDTH * rows)
  if (cols > blockCols) {
    // Too wide: pin to the block width and shrink the rows instead.
    cols = Math.max(blockCols, 1)
    rows = Math.round(cols / (aspect * CELL_HEIGHT_TO_WIDTH))
  }
  return { cols: Math.min(Math.max(cols, 1), Math.max(blockCols, 1)), rows: Math.max(rows, 1) }
}

/**
 * Scale RGBA pixels to an exact size with a box filter: every output pixel is
 * the average of its source box. Downscales smooth instead of shimmering;
 * upscales degenerate to nearest-neighbour (the box covers < 1 source pixel).
 */
export function scaleRgba(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8Array {
  const out = new Uint8Array(dstWidth * dstHeight * 4)
  for (let dy = 0; dy < dstHeight; dy += 1) {
    const y0 = Math.floor((dy * srcHeight) / dstHeight)
    const y1 = Math.max(Math.ceil(((dy + 1) * srcHeight) / dstHeight), y0 + 1)
    for (let dx = 0; dx < dstWidth; dx += 1) {
      const x0 = Math.floor((dx * srcWidth) / dstWidth)
      const x1 = Math.max(Math.ceil(((dx + 1) * srcWidth) / dstWidth), x0 + 1)
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let sy = y0; sy < y1 && sy < srcHeight; sy += 1) {
        for (let sx = x0; sx < x1 && sx < srcWidth; sx += 1) {
          const i = (sy * srcWidth + sx) * 4
          r += src[i] ?? 0
          g += src[i + 1] ?? 0
          b += src[i + 2] ?? 0
          a += src[i + 3] ?? 0
          n += 1
        }
      }
      const o = (dy * dstWidth + dx) * 4
      out[o] = Math.round(r / Math.max(n, 1))
      out[o + 1] = Math.round(g / Math.max(n, 1))
      out[o + 2] = Math.round(b / Math.max(n, 1))
      out[o + 3] = Math.round(a / Math.max(n, 1))
    }
  }
  return out
}
