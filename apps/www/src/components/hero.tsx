import { CopyButton } from '@/components/copy-button'
import { DemoVideo } from '@/components/demo-video'
import { Github } from '@/components/icons'
import { Button } from '@/components/ui/button'
import release from '@/data/release.json'

// Headline default (chosen from the design's options). Alternatives:
//   "Every chat. One terminal pane."
//   "All your chats, one keystroke away."
const HEADLINE = 'Your whole inbox. In your terminal.'
const INSTALL_CMD = 'brew install mitchmalone/tap/beeptui'

export function Hero() {
  return (
    <header id="top" className="relative overflow-hidden">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center px-6 pt-[88px] text-center">
        <p className="font-mono text-[13px] tracking-[0.02em] text-muted-foreground">
          open source · MIT · v{release.version}
        </p>
        <h1 className="mt-5 max-w-[16ch] text-balance text-[clamp(38px,6.5vw,68px)] font-semibold leading-[1.05] tracking-[-0.025em]">
          {HEADLINE}
        </h1>
        <p className="mt-[22px] max-w-[58ch] text-pretty text-[clamp(16px,2vw,19px)] leading-[1.55] text-muted-foreground">
          A fast, keyboard-first TUI for your Beeper unified inbox. WhatsApp, Slack, Telegram,
          Signal, Discord and more — read, search and reply without leaving the terminal.
        </p>
        <div className="mt-[34px] flex flex-wrap items-stretch justify-center gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-primary bg-card py-3 pr-2 pl-4 font-mono text-sm shadow-[0_0_24px_var(--glow)]">
            <span aria-hidden="true" className="text-muted-foreground">
              $
            </span>
            <span className="select-all">{INSTALL_CMD}</span>
            <CopyButton value={INSTALL_CMD} label="Copy install command" size={16} />
          </div>
          <Button
            variant="outline"
            render={<a href="https://github.com/mitchmalone/beeptui" />}
            className="h-auto gap-[9px] border-border bg-transparent px-[18px] py-3 text-foreground no-underline hover:border-primary hover:bg-transparent hover:text-foreground hover:no-underline dark:bg-transparent dark:hover:bg-transparent"
          >
            <Github size={16} />
            View on GitHub
          </Button>
        </div>
        <p className="mt-4 font-mono text-[12px] text-muted-foreground">
          Requires Beeper Desktop running locally. macOS tested; Linux via binary.
        </p>
      </div>

      <div className="relative mx-auto mt-14 -mb-[70px] max-w-[1100px] px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[10%] -top-10 h-[340px] bg-[radial-gradient(ellipse_60%_100%_at_50%_30%,var(--glow),transparent_70%)]"
        />
        <DemoVideo
          name="hero"
          poster
          label="beeptui — browsing the unified inbox, opening a Slack chat and sending a reply, all from the keyboard"
          className="relative rounded-xl border border-border"
        />
      </div>
    </header>
  )
}
