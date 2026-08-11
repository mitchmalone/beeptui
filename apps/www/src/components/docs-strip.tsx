import { ArrowRight } from '@/components/icons'
import { Reveal } from '@/components/reveal'

const DOC_LINKS = [
  { label: 'README', href: 'https://github.com/mitchmalone/beeptui#readme' },
  {
    label: 'Configuration',
    href: 'https://github.com/mitchmalone/beeptui/blob/main/docs/configuration.md',
  },
  {
    label: 'Contributing',
    href: 'https://github.com/mitchmalone/beeptui/blob/main/CONTRIBUTING.md',
  },
  { label: 'Roadmap', href: 'https://github.com/mitchmalone/beeptui/issues' },
  { label: 'Changelog', href: 'https://github.com/mitchmalone/beeptui/releases' },
]

export function DocsStrip() {
  return (
    <section id="docs" className="mx-auto max-w-[1100px] px-6 pt-[100px] pb-8">
      <Reveal as="h2" className="mb-8 font-mono text-sm font-normal text-muted-foreground">
        <span className="text-primary">{'//'}</span> docs
      </Reveal>
      {/* Reusable card grid — designed to grow into a real docs index on this domain later. */}
      <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {DOC_LINKS.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className="group flex items-center justify-between gap-2.5 rounded-lg border border-border bg-card px-4 py-[15px] text-sm font-medium text-foreground no-underline transition-colors hover:border-primary hover:text-primary hover:no-underline"
          >
            {label}
            <ArrowRight
              size={15}
              className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
            />
          </a>
        ))}
      </Reveal>
    </section>
  )
}
