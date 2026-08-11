import { Github } from '@/components/icons'

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-6 gap-y-3.5 px-6 py-[26px] font-mono text-[12px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
          <span className="text-foreground">beeptui</span>
          <span>MIT License</span>
          <span>© 2026 Mitch Malone</span>
        </div>
        <div className="flex items-center gap-[18px]">
          <a
            href="https://github.com/mitchmalone/beeptui"
            aria-label="GitHub"
            className="flex text-muted-foreground transition-colors hover:text-primary"
          >
            <Github size={16} />
          </a>
          <a
            href="https://x.com/mitchmalone"
            className="text-muted-foreground no-underline transition-colors hover:text-primary hover:no-underline"
          >
            @mitchmalone
          </a>
        </div>
      </div>
      <p className="mx-auto max-w-[1100px] px-6 pb-[26px] font-mono text-[11.5px] text-muted-foreground">
        Not affiliated with Beeper. beeptui is an independent open-source client.
      </p>
    </footer>
  )
}
