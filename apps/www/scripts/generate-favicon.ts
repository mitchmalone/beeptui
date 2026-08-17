/**
 * Regenerates the raster site favicons from the source mark at src/app/icon.svg
 * (Beeper's B + a terminal block cursor on Beeper blue). Next.js serves the SVG
 * directly; this produces the PNG/ICO fallbacks alongside it.
 * Run from apps/www: `bun run scripts/generate-favicon.ts`.
 *
 * Outputs: src/app/icon.png, src/app/apple-icon.png, src/app/favicon.ico.
 */
import sharp from 'sharp'

const SVG = 'src/app/icon.svg'
const png512 = await sharp(SVG, { density: 384 }).resize(512, 512).png().toBuffer()

await sharp(png512).resize(64, 64).toFile('src/app/icon.png')
await sharp(png512).resize(180, 180).toFile('src/app/apple-icon.png')

// Multi-size legacy favicon.ico (PNG entries).
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
