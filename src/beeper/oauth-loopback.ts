import { spawn } from 'node:child_process'
import { platform } from 'node:os'
import type { LoopbackReceiver } from '@/beeper/oauth.ts'

/**
 * Real side-effects for the OAuth flow, kept out of the unit-tested orchestrator
 * (`authorize` takes them injected). The loopback receiver binds an ephemeral
 * localhost port (RFC 8252 native-app redirect); `openUrl` hands the
 * authorization URL to the system browser.
 *
 * Security posture: the loopback binds to 127.0.0.1 only, serves exactly one
 * request path, and only accepts a callback carrying the CSRF `state` it was
 * armed with — any other local process racing the redirect gets a 400 and the
 * receiver keeps waiting for the real one. The received code lives in memory
 * and is handed straight to the orchestrator — never logged.
 */

/** Open a URL in the system browser (`open` on macOS, `xdg-open` elsewhere).
 *  The URL is a process argument, not a shell string, and only http(s) is
 *  accepted — a hostile `authorization_endpoint` must not reach an arbitrary
 *  OS URL handler (`file:`, custom schemes). */
export async function openUrl(url: string): Promise<void> {
  const protocol = new URL(url).protocol
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`Refusing to open non-http(s) URL in the browser`)
  }
  const command = platform() === 'darwin' ? 'open' : 'xdg-open'
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [url], { stdio: 'ignore', detached: true })
    child.on('error', reject)
    child.on('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

/**
 * Start a loopback receiver on an ephemeral 127.0.0.1 port, armed with the CSRF
 * `state` the redirect must carry. Resolves the first `/callback` request whose
 * `state` matches (including OAuth error redirects, which echo the state), shows
 * the user a "you can close this tab" page, and stops accepting after that.
 * `close()` is idempotent.
 */
export async function startLoopback(expectedState: string): Promise<LoopbackReceiver> {
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
      if (url.searchParams.get('state') !== expectedState) {
        // Forged or stray request: don't consume the one-shot wait.
        return new Response('Bad request', { status: 400 })
      }
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
