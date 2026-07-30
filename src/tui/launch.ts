import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { createElement } from 'react'
import { App } from '@/tui/app.tsx'

/** Boot the OpenTUI renderer and mount the app. Loaded lazily so CLI
 *  subcommands (`status`, `doctor`) never pull in the native renderer. */
export async function launch(): Promise<void> {
  const renderer = await createCliRenderer()
  createRoot(renderer).render(createElement(App))
}
