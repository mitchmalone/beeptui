import { spawn } from 'node:child_process'
import { copyFile } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The real OS side-effects behind the Slice 11 attachment actions, kept out of
 * the runtime so `openAttachment` / `saveAttachment` stay pure and testable.
 * Neither function logs the file path (invariant 6): the path is passed to the
 * OS handler as a process argument, never through a shell or a log line.
 */

/** A downloaded file's location may come back as a `file://` URL or a plain
 *  path; normalize to a filesystem path. */
function toPath(localPath: string): string {
  return localPath.startsWith('file://') ? fileURLToPath(localPath) : localPath
}

/** Open a local file with the OS default handler (`open` on macOS, `xdg-open`
 *  elsewhere). Detached so quitting the TUI doesn't kill the viewer. */
export async function openFile(localPath: string): Promise<void> {
  const command = platform() === 'darwin' ? 'open' : 'xdg-open'
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [toPath(localPath)], { stdio: 'ignore', detached: true })
    child.on('error', reject)
    child.unref()
    resolve()
  })
}

/** Run a notification command detached (Slice 14). Args are a fixed array — the
 *  configured command + a redacted summary — passed with no shell, so nothing is
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

/** Copy a downloaded file into the user's Downloads directory, returning just
 *  the saved filename (never the full path — that's what the UI shows). */
export async function saveToDownloads(
  localPath: string,
  fileName: string
): Promise<{ savedName: string }> {
  const savedName = basename(fileName)
  await copyFile(toPath(localPath), join(homedir(), 'Downloads', savedName))
  return { savedName }
}
