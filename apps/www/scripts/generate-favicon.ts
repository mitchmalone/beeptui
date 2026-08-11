/**
 * Regenerates the site favicon: Beeper's B mark + a terminal cursor underscore
 * on the site's dark tile. Run from the repo root: `bun run scripts/generate-favicon.ts`.
 *
 * The B is extracted from the locally installed Beeper Desktop app icon (so it
 * always matches their current mark) — requires macOS (`sips`) and Beeper Desktop.
 * Outputs: src/app/icon.png, src/app/apple-icon.png, src/app/favicon.ico.
 */
import sharp from 'sharp'
import { $ } from 'bun'

const ICNS = '/Applications/Beeper Desktop.app/Contents/Resources/icon.icns'
const TMP = `${process.env.TMPDIR ?? '/tmp'}/beeper-icon-512.png`
await $`sips -s format png --resampleWidth 512 ${ICNS} --out ${TMP}`.quiet()

// 1. Isolate the white B: alpha ramps with "whiteness" (min channel) so the
//    mark keeps its anti-aliased edges; the blue/purple gradient drops out.
const { data, info } = await sharp(TMP).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
for (let i = 0; i < data.length; i += 4) {
  const whiteness = Math.min(data[i], data[i + 1], data[i + 2])
  const alpha = Math.max(0, Math.min(1, (whiteness - 150) / 90)) * (data[i + 3] / 255)
  data[i] = 232 // site dark-theme foreground #e8e8ee
  data[i + 1] = 232
  data[i + 2] = 238
  data[i + 3] = Math.round(alpha * 255)
}
const bTrimmed = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png()
  .trim()
  .toBuffer()
const meta = await sharp(bTrimmed).metadata()

// 2. Compose: dark rounded tile, B centered with a purple cursor at its baseline.
const CANVAS = 512
const B_HEIGHT = 260
const GAP = 32
const CURSOR_W = 84 // block cursor, roughly a character cell
const CURSOR_H = 132
const bScaled = await sharp(bTrimmed).resize({ height: B_HEIGHT }).png().toBuffer()
const bW = Math.round((meta.width! / meta.height!) * B_HEIGHT)
const left = Math.round((CANVAS - (bW + GAP + CURSOR_W)) / 2)
const top = Math.round((CANVAS - B_HEIGHT) / 2)
const tile = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">
     <rect width="${CANVAS}" height="${CANVAS}" rx="112" fill="#0d0d12"/>
     <rect x="${left + bW + GAP}" y="${top + B_HEIGHT - CURSOR_H}" width="${CURSOR_W}" height="${CURSOR_H}" fill="#7c6cf5"/>
   </svg>`
)
const png512 = await sharp(tile)
  .composite([{ input: bScaled, left, top }])
  .png()
  .toBuffer()

// 3. Outputs: Next.js app icons + a multi-size legacy favicon.ico (PNG entries).
await sharp(png512).resize(64, 64).toFile('src/app/icon.png')
await sharp(png512).resize(180, 180).toFile('src/app/apple-icon.png')

const sizes = [16, 32, 48]
const pngs: Buffer[] = []
for (const s of sizes) pngs.push(await sharp(png512).resize(s, s).png().toBuffer())
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
const entries: Buffer[] = []
let offset = 6 + 16 * sizes.length
for (let i = 0; i < sizes.length; i++) {
  const e = Buffer.alloc(16)
  e.writeUInt8(sizes[i], 0)
  e.writeUInt8(sizes[i], 1)
  e.writeUInt16LE(1, 4)
  e.writeUInt16LE(32, 6)
  e.writeUInt32LE(pngs[i].length, 8)
  e.writeUInt32LE(offset, 12)
  offset += pngs[i].length
  entries.push(e)
}
await Bun.write('src/app/favicon.ico', Buffer.concat([header, ...entries, ...pngs]))
console.log('favicon regenerated: icon.png, apple-icon.png, favicon.ico')
