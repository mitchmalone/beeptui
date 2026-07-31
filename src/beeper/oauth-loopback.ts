import { spawn } from 'node:child_process'
import { platform } from 'node:os'
import type { LoopbackReceiver } from '@/beeper/oauth.ts'

/**
 * Real side-effects for the OAuth flow, kept out of the unit-tested orchestrator
 * (`authorize` takes them injected). The loopback receiver binds an ephemeral
 * localhost port (RFC 8252 native-app redirect); `openUrl` hands the
 * authorization URL to the system browser.
 *
 * Security note (for the review): the loopback binds to 127.0.0.1 only and
 * serves exactly one request path. The received code lives in memory and is
 * handed straight to the orchestrator — never logged.
 */

/** Open a URL in the system browser (`open` on macOS, `xdg-open` elsewhere).
 *  The URL is a process argument, not a shell string. */
export async function openUrl(url: string): Promise<void> {
  const command = platform() === 'darwin' ? 'open' : 'xdg-open'
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [url], { stdio: 'ignore', detached: true })
    child.on('error', reject)
    child.unref()
    resolve()
  })
}

/**
 * Start a loopback receiver on an ephemeral 127.0.0.1 port. Resolves the first
 * request to `/callback` as the OAuth redirect, shows the user a "you can close
 * this tab" page, and stops accepting after that. `close()` is idempotent.
 */
export async function startLoopback(): Promise<LoopbackReceiver> {
  let resolveCallback: (url: string) => void
  const callback = new Promise<string>((resolve) => {
    resolveCallback = resolve
  })

  const server = Bun.serve({
    port: 0, // ephemeral
    hostname: '127.0.0.1',
    fetch(request) {
      const url = new URL(request.url)
      if (url.pathname !== '/callback') return new Response('Not found', { status: 404 })
      resolveCallback(request.url)
      return new Response('beeper-tui: authentication complete — you can close this tab.', {
        headers: { 'content-type': 'text/plain' },
      })
    },
  })

  return {
    redirectUri: `http://127.0.0.1:${server.port}/callback`,
    awaitCallback: () => callback,
    close: () => {
      server.stop(true)
    },
  }
}
