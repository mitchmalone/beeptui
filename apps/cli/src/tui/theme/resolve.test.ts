import { describe, expect, test } from 'bun:test'
import { buildThemeRegistry, parseThemeFile, resolveTheme } from '@/tui/theme/resolve.ts'
import { DEFAULT_THEME, DRACULA_THEME } from '@/tui/theme/theme.ts'

describe('parseThemeFile', () => {
  test('partial file merges onto the default; provided tokens win', () => {
    const theme = parseThemeFile('{"selectionBg":"#ff0000","accent":"#00ff00"}', 'mine')
    expect(theme.name).toBe('mine')
    expect(theme.selectionBg).toBe('#ff0000')
    expect(theme.accent).toBe('#00ff00')
    expect(theme.fg).toBe(DEFAULT_THEME.fg) // inherited
  })

  test('an explicit name field overrides the filename', () => {
    expect(parseThemeFile('{"name":"Nord Night"}', 'nord').name).toBe('Nord Night')
  })

  test('rejects a non-hex token with a clear per-field message', () => {
    expect(() => parseThemeFile('{"accent":"red"}', 'bad')).toThrow(/"accent" must be a hex colour/)
  })

  test('rejects non-object / invalid JSON', () => {
    expect(() => parseThemeFile('nope', 'x')).toThrow(/not valid JSON/)
    expect(() => parseThemeFile('[1,2]', 'x')).toThrow(/must be a JSON object/)
  })
})

describe('buildThemeRegistry + resolveTheme', () => {
  const noFiles = { listThemeFiles: () => [], readThemeFile: () => undefined }

  test('registry contains the built-ins', () => {
    const reg = buildThemeRegistry(noFiles)
    expect(reg.get('dracula')).toEqual(DRACULA_THEME)
    expect(reg.get('default')?.name).toBe('default')
    expect(reg.get('system')?.name).toBe('system')
  })

  test('custom folder themes are registered and can override a built-in', () => {
    const reg = buildThemeRegistry({
      listThemeFiles: () => ['nord.json', 'notes.txt', 'dracula.json'],
      readThemeFile: (f) =>
        f === 'nord.json'
          ? '{"accent":"#88c0d0"}'
          : f === 'dracula.json'
            ? '{"accent":"#000000"}'
            : undefined,
    })
    expect(reg.get('nord')?.accent).toBe('#88c0d0') // new custom theme
    expect(reg.get('dracula')?.accent).toBe('#000000') // built-in overridden by file
    expect(reg.has('notes')).toBe(false) // non-json ignored
  })

  test('resolveTheme: absent → system, known → that theme, unknown → default', () => {
    const reg = buildThemeRegistry(noFiles)
    expect(resolveTheme(undefined, reg).name).toBe('system')
    expect(resolveTheme('dracula', reg)).toEqual(DRACULA_THEME)
    expect(resolveTheme('nonesuch', reg)).toEqual(DEFAULT_THEME)
  })
})
