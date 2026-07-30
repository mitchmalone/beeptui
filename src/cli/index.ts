#!/usr/bin/env bun
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { createElement } from 'react'
import { App } from '@/tui/app.tsx'

/**
 * Entry point. Slice 0 only knows how to launch the TUI shell; `status`,
 * `doctor`, and `config` subcommands arrive with the adapter in Slice 1.
 */
async function main() {
  const renderer = await createCliRenderer()
  createRoot(renderer).render(createElement(App))
}

await main()
