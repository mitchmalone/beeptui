/**
 * Whether `beeptui login` can actually complete a browser OAuth flow against the
 * configured endpoint.
 *
 * Without this check `login` always ran the remote flow: against a Beeper
 * Desktop with remote access off it opened the advertised
 * `authorization_endpoint` — a static localhost page — and then waited forever on
 * a loopback callback that never came. A dead control, which invariant 8 forbids.
 *
 * Pure, so it can be tested without a live endpoint.
 */

export type EndpointKind = 'local' | 'remote'

export interface LoginPreflightInput {
  endpointKind: EndpointKind
  /** `server.remote_access` from `/v1/info`. */
  remoteAccessEnabled: boolean
}

export type LoginPreflight =
  { ok: true } | { ok: false; reason: 'remote-access-off'; message: string }

/**
 * The gate is `remote_access`, not locality. That flag is what says the OAuth
 * endpoints are real; a *local* endpoint with remote access switched on serves a
 * genuine authorization page, and refusing it on locality alone would block a
 * legitimate pairing flow we have no evidence is broken. The endpoint kind only
 * decides which way out to point the user.
 */
export function loginPreflight({
  endpointKind,
  remoteAccessEnabled,
}: LoginPreflightInput): LoginPreflight {
  if (remoteAccessEnabled) return { ok: true }

  const message =
    endpointKind === 'local'
      ? [
          'This endpoint is a local Beeper Desktop with remote access off, so there is no browser',
          'login to complete — local access uses a token, which you already have if `beeptui',
          'doctor` is green. Just run `beeptui`.',
          '',
          'To use a remote server instead: turn on remote access in Beeper, or point',
          'BEEPTUI_ENDPOINT at a remote Server Client, then run `beeptui login` again.',
        ].join('\n')
      : [
          'This endpoint reports remote access off, so it cannot complete a browser login.',
          '',
          'Turn on remote access in Beeper for this server, then run `beeptui login` again.',
        ].join('\n')

  return { ok: false, reason: 'remote-access-off', message }
}
