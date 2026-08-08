import { spawn } from 'node:child_process'
import { constants, copyFile, stat } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
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

/** Open a local file with the OS default handler (`open` on macOS, `xdg-open`
 *  elsewhere). Detached so quitting the TUI doesn't kill the viewer. Rejects
 *  when the file doesn't exist or the handler can't launch — a failed open must
 *  surface as a failure, never report success (invariant 8). Only real local
 *  files are opened: an endpoint-supplied URL must not reach the OS handler. */
export async function openFile(
  localPath: string,
  spawner: Spawner = defaultSpawner
): Promise<void> {
  const path = toLocalPath(localPath)
  const info = await stat(path).catch(() => null)
  if (info === null || !info.isFile()) {
    throw new Error('Attachment file not found on disk')
  }
  const command = platform() === 'darwin' ? 'open' : 'xdg-open'
  await new Promise<void>((resolve, reject) => {
    const child = spawner(command, [path])
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
