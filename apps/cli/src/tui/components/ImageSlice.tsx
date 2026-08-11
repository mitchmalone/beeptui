import { ptr } from 'bun:ffi'
import { Renderable, type RenderableOptions, type RenderContext } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'
import { extend } from '@opentui/react'
import type { ImagePreviewCache } from '@/tui/image-preview-cache.ts'

/**
 * One row of an inline image block. The conversation renders rows one element
 * high, so each image row paints only its own 2-pixel band of the scaled
 * thumbnail — which makes partial visibility at the viewport edges free, and
 * keeps the per-row caret/selection chrome untouched.
 *
 * The view only mounts this element once the cache entry is `ready` (text
 * placeholders cover loading/failed), so `renderSelf` is pure paint: no
 * fetching, no state. Cache misses (evicted between render and paint) draw
 * nothing for a frame and the next subscription bump swaps back to text.
 */

interface ImageSliceOptions extends RenderableOptions<ImageSliceRenderable> {
  attachmentId?: string
  slice?: number
  of?: number
  /** Cache key width — passed explicitly so the renderable and the view ask
   *  for the same entry, whatever this element's flexed width resolves to. */
  blockCols?: number
  cache?: ImagePreviewCache | null
  /** Cache version at mount/update — a prop bump marks the tree dirty when
   *  an entry lands, so a paint follows without polling. */
  version?: number
}

export class ImageSliceRenderable extends Renderable {
  attachmentId = ''
  slice = 0
  of = 1
  blockCols = 0
  cache: ImagePreviewCache | null = null
  version = 0

  constructor(ctx: RenderContext, options: ImageSliceOptions) {
    super(ctx, options)
    this.attachmentId = options.attachmentId ?? ''
    this.slice = options.slice ?? 0
    this.of = options.of ?? 1
    this.blockCols = options.blockCols ?? 0
    this.cache = options.cache ?? null
    this.version = options.version ?? 0
  }

  protected override renderSelf(buffer: OptimizedBuffer): void {
    if (this.cache === null || this.attachmentId === '' || this.blockCols <= 0) return
    const entry = this.cache.get(this.attachmentId, this.blockCols, this.of)
    if (entry.status !== 'ready' || this.slice >= entry.rows) return
    // The thumbnail is (2·cols)×(2·rows) px, row stride 2·cols·4 bytes; this
    // row's band is 2 pixel rows starting at slice·2. The native draw has no
    // horizontal bound of its own — it samples 2×2 px per cell out to the
    // buffer edge, reading wrapped garbage past the image — so the image's
    // cell rectangle is enforced with a scissor.
    const stride = entry.cols * 2 * 4
    const band = entry.rgba.subarray(this.slice * 2 * stride, (this.slice * 2 + 2) * stride)
    if (band.length === 0) return
    buffer.pushScissorRect(this.x, this.y, Math.min(entry.cols, this.width), 1)
    try {
      buffer.drawSuperSampleBuffer(this.x, this.y, ptr(band), band.length, 'rgba8unorm', stride)
    } finally {
      buffer.popScissorRect()
    }
  }
}

extend({ 'image-slice': ImageSliceRenderable })

declare module '@opentui/react' {
  interface OpenTUIComponents {
    'image-slice': typeof ImageSliceRenderable
  }
}
