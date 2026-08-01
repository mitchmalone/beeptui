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
})
