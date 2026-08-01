import { describe, expect, test } from 'bun:test'
import { DEFAULT_ENDPOINT, resolveConfig } from '@/beeper/config.ts'

const home = '/home/ada'

describe('resolveConfig', () => {
  test('defaults to the local Desktop endpoint with no env or file', () => {
    const cfg = resolveConfig({ env: {}, homedir: home, readFile: () => undefined })
    expect(cfg.endpoint).toBe(DEFAULT_ENDPOINT)
    expect(cfg.configPath).toBe('/home/ada/.config/beeper-tui/config.json')
  })

  test('honors XDG_CONFIG_HOME for the config path', () => {
    const cfg = resolveConfig({
      env: { XDG_CONFIG_HOME: '/xdg' },
      homedir: home,
      readFile: () => undefined,
    })
    expect(cfg.configPath).toBe('/xdg/beeper-tui/config.json')
  })

  test('config file endpoint overrides the default', () => {
    const cfg = resolveConfig({
      env: {},
      homedir: home,
      readFile: () => JSON.stringify({ endpoint: 'http://127.0.0.1:9999' }),
    })
    expect(cfg.endpoint).toBe('http://127.0.0.1:9999')
  })

  test('env var wins over the config file', () => {
    const cfg = resolveConfig({
      env: { BEEPER_TUI_ENDPOINT: 'http://127.0.0.1:1111' },
      homedir: home,
      readFile: () => JSON.stringify({ endpoint: 'http://127.0.0.1:9999' }),
    })
    expect(cfg.endpoint).toBe('http://127.0.0.1:1111')
  })

  test('rejects a non-http(s) endpoint with a clear error', () => {
    expect(() =>
      resolveConfig({
        env: { BEEPER_TUI_ENDPOINT: 'ftp://nope' },
        homedir: home,
        readFile: () => undefined,
      })
    ).toThrow(/endpoint/i)
  })

  test('rejects a malformed config file with a clear error', () => {
    expect(() => resolveConfig({ env: {}, homedir: home, readFile: () => '{ not json' })).toThrow(
      /config/i
    )
  })

  test('rejects plain http for a non-loopback endpoint (token would transit cleartext)', () => {
    expect(() =>
      resolveConfig({
        env: { BEEPER_TUI_ENDPOINT: 'http://my-vps.example:23373' },
        homedir: home,
        readFile: () => undefined,
      })
    ).toThrow(/https/i)
  })

  test('allows http for loopback hosts and https for remote hosts', () => {
    for (const endpoint of [
      'http://localhost:23373',
      'http://127.0.0.1:23373',
      'http://[::1]:23373',
      'https://remote.example:23373',
    ]) {
      const cfg = resolveConfig({
        env: { BEEPER_TUI_ENDPOINT: endpoint },
        homedir: home,
        readFile: () => undefined,
      })
      expect(cfg.endpoint).toBe(endpoint)
    }
  })

  test('never sources a token from the config file (config holds no secrets)', () => {
    const cfg = resolveConfig({
      env: {},
      homedir: home,
      readFile: () => JSON.stringify({ endpoint: DEFAULT_ENDPOINT, token: 'should-be-ignored' }),
    })
    expect(JSON.stringify(cfg)).not.toContain('should-be-ignored')
  })

  test('notify defaults to null and parses a valid command array', () => {
    expect(resolveConfig({ env: {}, homedir: home, readFile: () => undefined }).notify).toBeNull()
    const cfg = resolveConfig({
      env: {},
      homedir: home,
      readFile: () => JSON.stringify({ notify: { command: ['terminal-notifier', '-message'] } }),
    })
    expect(cfg.notify).toEqual({ command: ['terminal-notifier', '-message'] })
  })

  test('rejects a malformed notify config with a clear error', () => {
    expect(() =>
      resolveConfig({
        env: {},
        homedir: home,
        readFile: () => JSON.stringify({ notify: { command: [] } }),
      })
    ).toThrow(/notify\.command/)
    expect(() =>
      resolveConfig({
        env: {},
        homedir: home,
        readFile: () => JSON.stringify({ notify: { command: 'not-an-array' } }),
      })
    ).toThrow(/notify\.command/)
  })

  test('endpoints: a name in `endpoint` resolves to the configured URL', () => {
    const cfg = resolveConfig({
      env: {},
      homedir: home,
      readFile: () =>
        JSON.stringify({
          endpoint: 'remote',
          endpoints: { local: 'http://127.0.0.1:23373', remote: 'https://beeper.example.com' },
        }),
    })
    expect(cfg.endpoint).toBe('https://beeper.example.com')
    expect(cfg.endpoints.local).toBe('http://127.0.0.1:23373')
  })

  test('endpoints: env BEEPER_TUI_ENDPOINT can select a name too', () => {
    const cfg = resolveConfig({
      env: { BEEPER_TUI_ENDPOINT: 'remote' },
      homedir: home,
      readFile: () => JSON.stringify({ endpoints: { remote: 'https://r.example.com' } }),
    })
    expect(cfg.endpoint).toBe('https://r.example.com')
  })

  test('endpoints: a literal URL that is not a configured name is used verbatim', () => {
    const cfg = resolveConfig({
      env: { BEEPER_TUI_ENDPOINT: 'https://direct.example.com' },
      homedir: home,
      readFile: () => JSON.stringify({ endpoints: { remote: 'https://r.example.com' } }),
    })
    expect(cfg.endpoint).toBe('https://direct.example.com')
  })

  test('endpoints: rejects a non-URL entry with a clear error', () => {
    expect(() =>
      resolveConfig({
        env: {},
        homedir: home,
        readFile: () => JSON.stringify({ endpoints: { bad: 'not-a-url' } }),
      })
    ).toThrow(/endpoint/i)
  })

  test('keymap defaults to null and parses valid overrides', () => {
    expect(resolveConfig({ env: {}, homedir: home, readFile: () => undefined }).keymap).toBeNull()
    const cfg = resolveConfig({
      env: {},
      homedir: home,
      readFile: () => JSON.stringify({ keymap: { quit: ['x'], 'move-down': ['down', 'shift+j'] } }),
    })
    expect(cfg.keymap).toEqual({ quit: ['x'], 'move-down': ['down', 'shift+j'] })
  })

  test('rejects a malformed keymap override with a clear error', () => {
    expect(() =>
      resolveConfig({ env: {}, homedir: home, readFile: () => JSON.stringify({ keymap: [] }) })
    ).toThrow(/keymap.*object/)
    expect(() =>
      resolveConfig({
        env: {},
        homedir: home,
        readFile: () => JSON.stringify({ keymap: { quit: 'x' } }),
      })
    ).toThrow(/keymap\.quit/)
  })

  test('theme defaults to null and parses valid network colours', () => {
    expect(resolveConfig({ env: {}, homedir: home, readFile: () => undefined }).theme).toBeNull()
    const cfg = resolveConfig({
      env: {},
      homedir: home,
      readFile: () => JSON.stringify({ theme: { networkColors: { WhatsApp: '#123abc' } } }),
    })
    expect(cfg.theme).toEqual({ networkColors: { WhatsApp: '#123abc' } })
  })

  test('rejects a non-hex theme colour with a clear error', () => {
    expect(() =>
      resolveConfig({
        env: {},
        homedir: home,
        readFile: () => JSON.stringify({ theme: { networkColors: { WhatsApp: 'green' } } }),
      })
    ).toThrow(/networkColors\.WhatsApp.*hex/)
  })

  test('parses theme.density and allows a density-only theme block', () => {
    const cfg = resolveConfig({
      env: {},
      homedir: home,
      readFile: () => JSON.stringify({ theme: { density: 'compact' } }),
    })
    expect(cfg.theme).toEqual({ networkColors: {}, density: 'compact' })
  })

  test('rejects an invalid theme.density with a clear error', () => {
    expect(() =>
      resolveConfig({
        env: {},
        homedir: home,
        readFile: () => JSON.stringify({ theme: { density: 'cozy' } }),
      })
    ).toThrow(/theme\.density.*comfortable.*compact/)
  })
})
