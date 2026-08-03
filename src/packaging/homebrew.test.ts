import { describe, expect, test } from 'bun:test'
import { renderFormula, type FormulaInputs } from '@/packaging/homebrew.ts'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)

const valid: FormulaInputs = {
  version: '1.2.0',
  repo: 'mitchmalone/beeptui',
  darwinArm64Sha256: SHA_A,
  linuxX64Sha256: SHA_B,
}

describe('renderFormula', () => {
  test('embeds version, per-target URLs, and matching SHA-256s', () => {
    const rb = renderFormula(valid)
    expect(rb).toContain('class Beeptui < Formula')
    expect(rb).toContain('version "1.2.0"')
    expect(rb).toContain('license "MIT"')
    expect(rb).toContain(
      'https://github.com/mitchmalone/beeptui/releases/download/v1.2.0/beeptui-darwin-arm64'
    )
    expect(rb).toContain(
      'https://github.com/mitchmalone/beeptui/releases/download/v1.2.0/beeptui-linux-x64'
    )
    expect(rb).toContain(`sha256 "${SHA_A}"`)
    expect(rb).toContain(`sha256 "${SHA_B}"`)
    expect(rb).toContain('bin.install "beeptui-darwin-arm64" => "beeptui"')
    expect(rb).toContain('bin.install "beeptui-linux-x64" => "beeptui"')
  })

  test('rejects a non-semver version', () => {
    expect(() => renderFormula({ ...valid, version: 'latest' })).toThrow(/semver/)
  })

  test('rejects a malformed repo', () => {
    expect(() => renderFormula({ ...valid, repo: 'not-a-repo' })).toThrow(/owner\/repo/)
  })

  test('rejects a non-hex or wrong-length SHA-256', () => {
    expect(() => renderFormula({ ...valid, darwinArm64Sha256: 'deadbeef' })).toThrow(/SHA-256/)
    expect(() => renderFormula({ ...valid, linuxX64Sha256: 'Z'.repeat(64) })).toThrow(/SHA-256/)
  })
})
