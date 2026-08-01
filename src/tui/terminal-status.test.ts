import { describe, expect, test } from 'bun:test'
import { createStatusWriter } from '@/tui/terminal-status.ts'

const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const title = (label: string) => `${ESC}]2;${label}${BEL}` // OSC 2 … BEL

function harness(env: Record<string, string | undefined>) {
  const writes: string[] = []
  const tmux: string[][] = []
  const writer = createStatusWriter({
    env,
    write: (s) => writes.push(s),
    runTmux: (a) => tmux.push(a),
  })
  return { writer, writes, tmux }
}

const IN_TMUX = { TMUX: '/tmp/tmux-501/default,84775,0', TMUX_PANE: '%3' }

describe('createStatusWriter', () => {
  test('in tmux: sets the window name and the OSC 2 title to "Beeper [n]"', () => {
    const { writer, writes, tmux } = harness(IN_TMUX)
    writer.update(19)
    expect(writes).toEqual([title('Beeper [19]')])
    expect(tmux).toEqual([['rename-window', '-t', '%3', 'Beeper [19]']])
  })

  test('dedups: the same count does not re-emit', () => {
    const { writer, writes, tmux } = harness(IN_TMUX)
    writer.update(3)
    writer.update(3)
    expect(writes).toHaveLength(1)
    expect(tmux).toHaveLength(1)
  })

  test('a changed count re-emits with the new number', () => {
    const { writer, tmux } = harness(IN_TMUX)
    writer.update(3)
    writer.update(4)
    expect(tmux.map((a) => a.at(-1))).toEqual(['Beeper [3]', 'Beeper [4]'])
  })

  test('outside tmux: writes the terminal title but runs no tmux command', () => {
    const { writer, writes, tmux } = harness({})
    writer.update(7)
    expect(writes).toEqual([title('Beeper [7]')])
    expect(tmux).toEqual([])
  })

  test('restore hands the window name back to tmux (no-op outside tmux)', () => {
    const inside = harness(IN_TMUX)
    inside.writer.restore()
    expect(inside.tmux).toEqual([['set-window-option', '-t', '%3', '-u', 'automatic-rename']])

    const outside = harness({})
    outside.writer.restore()
    expect(outside.tmux).toEqual([])
  })

  test('emits only the app name and count — never chat content (invariant 6)', () => {
    const { writer, writes, tmux } = harness(IN_TMUX)
    writer.update(42)
    // Everything emitted is the fixed title escape + the fixed tmux command; the
    // only variable is the integer, so no chat name/sender/token can leak.
    expect(writes).toEqual([title('Beeper [42]')])
    expect(tmux).toEqual([['rename-window', '-t', '%3', 'Beeper [42]']])
  })
})
