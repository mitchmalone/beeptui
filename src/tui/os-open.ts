import { spawn } from 'node:child_process'
import { constants, copyFile, mkdtemp, stat } from 'node:fs/promises'
import { homedir, platform, tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The real OS side-effects behind the attachment actions, kept out of the
 * runtime so `openAttachment` / `saveAttachment` stay pure and testable.
 * Neither function logs the file path (invariant 6): the path is passed to the
 * OS handler as a process argument, never through a shell or a log line.
 */

/** The minimal child surface `openFile` needs — injectable so tests never
 *  launch a real viewer. */
export interface SpawnedChild {
  on(event: 'error', listener: (err: Error) => void): unknown
  on(event: 'spawn', listener: () => void): unknown
  unref(): void
}
export type Spawner = (command: string, args: string[]) => SpawnedChild

const defaultSpawner: Spawner = (command, args) =>
  spawn(command, args, { stdio: 'ignore', detached: true })

/** A downloaded file's location may come back as a `file://` URL or a plain
 *  path; normalize to a filesystem path. */
export function toLocalPath(localPath: string): string {
  return localPath.startsWith('file://') ? fileURLToPath(localPath) : localPath
}

/** What the attachment metadata says the file is — used to give an
 *  extension-less download a typed name the OS can dispatch on. */
export interface OpenTypeHint {
  fileName?: string | undefined
  mimeType?: string | undefined
}

/** The formats worth mapping when the attachment has a MIME type but no
 *  usable filename. Unknown types stay unmapped: the file opens as-is and the
 *  OS gives its honest answer. */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
}

/**
 * Beeper's download files are extension-less blobs; macOS `open` then guesses
 * text encoding and fails ("Unicode (UTF-8) isn't applicable"). When metadata
 * knows better, hand the OS a typed copy: the attachment's own filename (or
 * `attachment.<ext>` from the MIME type) in a fresh temp dir — unique by
 * construction, cleaned by the OS. Returns null when the path already has an
 * extension or nothing better is known.
 */
async function typedCopy(path: string, hint: OpenTypeHint): Promise<string | null> {
  if (extname(path) !== '') return null
  const hintedName = hint.fileName !== undefined ? basename(hint.fileName) : ''
  const hintedExt = extname(hintedName)
  const mimeExt = (hint.mimeType !== undefined ? MIME_EXTENSIONS[hint.mimeType] : undefined) ?? ''
  const name = hintedExt !== '' ? hintedName : mimeExt !== '' ? `attachment${mimeExt}` : ''
  if (name === '') return null
  const dir = await mkdtemp(join(tmpdir(), 'beeptui-open-'))
  const target = join(dir, name)
  await copyFile(path, target)
  return target
}

/** Open a local file with the OS default handler (`open` on macOS, `xdg-open`
 *  elsewhere). Detached so quitting the TUI doesn't kill the viewer. Rejects
 *  when the file doesn't exist or the handler can't launch — a failed open must
 *  surface as a failure, never report success (invariant 8). Only real local
 *  files are opened: an endpoint-supplied URL must not reach the OS handler. */
export async function openFile(
  localPath: string,
  hint: OpenTypeHint = {},
  spawner: Spawner = defaultSpawner
): Promise<void> {
  const path = toLocalPath(localPath)
  const info = await stat(path).catch(() => null)
  if (info === null || !info.isFile()) {
    throw new Error('Attachment file not found on disk')
  }
  const typed = await typedCopy(path, hint)
  const command = platform() === 'darwin' ? 'open' : 'xdg-open'
  await new Promise<void>((resolve, reject) => {
    const child = spawner(command, [typed ?? path])
    child.on('error', reject)
    child.on('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

/** Run a notification command detached. Args are a fixed array — the configured
 *  command + a redacted summary — passed with no shell, so nothing is
 *  interpolated. Best-effort: a spawn error is swallowed (a missing notifier
 *  must never crash the TUI). */
export function runNotifier(args: string[]): void {
  const [command, ...rest] = args
  if (command === undefined) return
  try {
    const child = spawn(command, rest, { stdio: 'ignore', detached: true })
    child.on('error', () => {}) // notifier not installed → ignore
    child.unref()
  } catch {
    // never let a notifier failure surface
  }
}

/** `report.pdf` → `report (2).pdf` — the candidate name for save attempt `n`. */
function candidateName(fileName: string, attempt: number): string {
  if (attempt === 0) return fileName
  const ext = extname(fileName)
  return `${fileName.slice(0, fileName.length - ext.length)} (${attempt})${ext}`
}

/** Copy a downloaded file into the user's Downloads directory, returning just
 *  the saved filename (never the full path — that's what the UI shows). The
 *  filename is sender-controlled, so saving never overwrites an existing file:
 *  on collision the name gets a ` (n)` suffix, exclusive-create each attempt. */
export async function saveToDownloads(
  localPath: string,
  fileName: string,
  downloadsDir: string = join(homedir(), 'Downloads')
): Promise<{ savedName: string }> {
  const base = basename(fileName)
  for (let attempt = 0; attempt < 100; attempt++) {
    const savedName = candidateName(base, attempt)
    try {
      await copyFile(toLocalPath(localPath), join(downloadsDir, savedName), constants.COPYFILE_EXCL)
      return { savedName }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'EEXIST') throw err
    }
  }
  throw new Error('Could not find a free filename in Downloads')
}
