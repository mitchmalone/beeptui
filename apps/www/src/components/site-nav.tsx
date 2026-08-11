import { Github } from '@/components/icons'
import { ThemeToggle } from '@/components/theme-toggle'

const navLink =
  'hidden text-sm text-muted-foreground no-underline transition-colors hover:text-foreground hover:no-underline sm:inline'

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/[0.78] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-4 px-6">
        <a
          href="#top"
          className="flex items-center font-mono text-[15px] font-medium text-foreground no-underline hover:no-underline"
        >
          beeptui
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-4 w-2 animate-blink bg-primary"
          />
        </a>
        <div className="flex items-center gap-[22px]">
          <a href="#features" className={navLink}>
            Features
          </a>
          <a href="#install" className={navLink}>
            Install
          </a>
          <a href="#docs" className={navLink}>
            Docs
          </a>
          <ThemeToggle />
          <a
            href="https://github.com/mitchmalone/beeptui"
            aria-label="GitHub repository"
            className="flex text-muted-foreground transition-colors hover:text-primary"
          >
            <Github size={18} />
          </a>
        </div>
      </div>
    </nav>
  )
}
