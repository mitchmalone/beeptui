import { describe, expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openFile, saveToDownloads, type Spawner } from '@/tui/os-open.ts'

/** A fake spawner whose child immediately emits `spawn` or `error`. */
function fakeSpawner(outcome: 'spawn' | 'error'): { spawner: Spawner; calls: string[][] } {
  const calls: string[][] = []
  const spawner: Spawner = (command, args) => {
    calls.push([command, ...args])
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = () => {}
    queueMicrotask(() => {
      if (outcome === 'error') child.emit('error', new Error('ENOENT'))
      else child.emit('spawn')
    })
    return child
  }
  return { spawner, calls }
}

describe('openFile', () => {
  test('resolves only after the OS handler actually launches', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'os-open-'))
    const file = join(dir, 'photo.png')
    await writeFile(file, 'png-bytes')
    const { spawner, calls } = fakeSpawner('spawn')
    await openFile(file, {}, spawner)
    expect(calls[0]?.[1]).toBe(file)
  })

  test('rejects when the handler fails to launch — never a fake success (invariant 8)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'os-open-'))
    const file = join(dir, 'doc.pdf')
    await writeFile(file, 'pdf-bytes')
    const { spawner } = fakeSpawner('error')
    await expect(openFile(file, {}, spawner)).rejects.toThrow()
  })

  test('rejects a path that does not exist without spawning anything', async () => {
    const { spawner, calls } = fakeSpawner('spawn')
    await expect(openFile('/nowhere/at/all.bin', {}, spawner)).rejects.toThrow(/not found/)
    expect(calls).toHaveLength(0)
  })
})

describe('saveToDownloads', () => {
  test('saves under the attachment filename and reports it', async () => {
    const src = await mkdtemp(join(tmpdir(), 'os-open-src-'))
    const downloads = await mkdtemp(join(tmpdir(), 'os-open-dl-'))
    const local = join(src, 'blob')
    await writeFile(local, 'data')
    const { savedName } = await saveToDownloads(local, 'report.pdf', downloads)
    expect(savedName).toBe('report.pdf')
    expect(await readFile(join(downloads, 'report.pdf'), 'utf8')).toBe('data')
  })

  test('never overwrites an existing file — a sender-controlled name gets a suffix instead', async () => {
    const src = await mkdtemp(join(tmpdir(), 'os-open-src-'))
    const downloads = await mkdtemp(join(tmpdir(), 'os-open-dl-'))
    await writeFile(join(downloads, 'Setup.dmg'), 'the-real-installer')
    const local = join(src, 'blob')
    await writeFile(local, 'attacker-content')

    const first = await saveToDownloads(local, 'Setup.dmg', downloads)
    expect(first.savedName).toBe('Setup (1).dmg')
    const second = await saveToDownloads(local, 'Setup.dmg', downloads)
    expect(second.savedName).toBe('Setup (2).dmg')
    // The pre-existing file is untouched.
    expect(await readFile(join(downloads, 'Setup.dmg'), 'utf8')).toBe('the-real-installer')
  })

  test('strips any directory components from the attachment filename', async () => {
    const src = await mkdtemp(join(tmpdir(), 'os-open-src-'))
    const downloads = await mkdtemp(join(tmpdir(), 'os-open-dl-'))
    const local = join(src, 'blob')
    await writeFile(local, 'data')
    const { savedName } = await saveToDownloads(local, '../../etc/passwd', downloads)
    expect(savedName).toBe('passwd')
  })
})

describe('openFile type hints', () => {
  // Beeper downloads are extension-less blobs; macOS `open` guesses "text" and
  // fails ("Unicode (UTF-8) isn't applicable"). With attachment metadata the
  // OS gets a typed copy instead.
  test('an extension-less file opens as a typed copy named after the attachment', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'os-open-'))
    const blob = join(dir, 'mitchtest_abc123')
    await writeFile(blob, 'jpeg-bytes')
    const { spawner, calls } = fakeSpawner('spawn')
    await openFile(blob, { fileName: 'holiday.jpg', mimeType: 'image/jpeg' }, spawner)
    const opened = calls[0]?.[1] ?? ''
    expect(opened.endsWith('/holiday.jpg')).toBe(true)
    expect(opened).not.toBe(blob)
    expect(await readFile(opened, 'utf8')).toBe('jpeg-bytes')
  })

  test('a MIME type alone maps to a generic typed name', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'os-open-'))
    const blob = join(dir, 'blob_no_ext')
    await writeFile(blob, 'png-bytes')
    const { spawner, calls } = fakeSpawner('spawn')
    await openFile(blob, { mimeType: 'image/png' }, spawner)
    expect((calls[0]?.[1] ?? '').endsWith('/attachment.png')).toBe(true)
  })

  test('a file that already has an extension opens directly, no copy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'os-open-'))
    const file = join(dir, 'photo.png')
    await writeFile(file, 'png-bytes')
    const { spawner, calls } = fakeSpawner('spawn')
    await openFile(file, { fileName: 'other.jpg' }, spawner)
    expect(calls[0]?.[1]).toBe(file)
  })

  test('no usable hint leaves the path untouched — the OS gives its honest answer', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'os-open-'))
    const blob = join(dir, 'blob_no_ext')
    await writeFile(blob, 'bytes')
    const { spawner, calls } = fakeSpawner('spawn')
    await openFile(blob, { mimeType: 'application/x-unknown' }, spawner)
    expect(calls[0]?.[1]).toBe(blob)
  })
})
