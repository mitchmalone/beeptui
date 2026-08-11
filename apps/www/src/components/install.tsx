import { CopyButton } from '@/components/copy-button'
import { Reveal } from '@/components/reveal'

function CommandLine({ cmd }: { cmd: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[13.5px]">
      <span aria-hidden="true" className="text-muted-foreground">
        $
      </span>
      <span className="flex-1 overflow-x-auto whitespace-nowrap">{cmd}</span>
      <CopyButton value={cmd} />
    </div>
  )
}

export function Install() {
  return (
    <section id="install" className="mx-auto max-w-[760px] px-6 pt-[100px] pb-8">
      <Reveal as="h2" className="mb-10 font-mono text-sm font-normal text-muted-foreground">
        <span className="text-primary">{'//'}</span> install
      </Reveal>
      <Reveal className="flex flex-col gap-6">
        {/* Homebrew */}
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex items-center gap-2.5 border-b border-border px-[18px] py-3">
            <span className="text-sm font-semibold">Homebrew</span>
            <span className="font-mono text-[11px] text-muted-foreground">recommended</span>
          </div>
          <div className="flex flex-col gap-2.5 px-[18px] py-4">
            <CommandLine cmd="brew install mitchmalone/tap/beeptui" />
            <CommandLine cmd="beeptui doctor" />
          </div>
        </div>

        {/* Binary */}
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="border-b border-border px-[18px] py-3">
            <span className="text-sm font-semibold">Binary</span>
          </div>
          <div className="flex flex-col gap-3 px-[18px] py-4">
            <p className="text-[14px] leading-[1.55] text-muted-foreground">
              Download for your OS from{' '}
              <a href="https://github.com/mitchmalone/beeptui/releases">GitHub Releases</a>, verify
              against <span className="font-mono text-[12.5px]">sha256sums.txt</span>, then:
            </p>
            <CommandLine cmd="shasum -a 256 -c sha256sums.txt && chmod +x beeptui-*" />
          </div>
        </div>

        {/* From source */}
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex items-center gap-2.5 border-b border-border px-[18px] py-3">
            <span className="text-sm font-semibold">From source</span>
            <span className="font-mono text-[11px] text-muted-foreground">needs Bun ≥ 1.3.14</span>
          </div>
          <div className="flex flex-col gap-2.5 px-[18px] py-4">
            <CommandLine cmd="bun install" />
            <CommandLine cmd="bun run src/cli/index.ts" />
          </div>
        </div>

        <p className="mt-1 text-[14px] leading-[1.6] text-muted-foreground">
          <span className="font-medium text-foreground">First run:</span> create a token in Beeper
          Desktop → Settings → Integrations → Approved connections, then run{' '}
          <span className="font-mono text-[12.5px]">beeptui doctor</span> to check everything. Full
          setup in the <a href="https://github.com/mitchmalone/beeptui#readme">README</a>.
        </p>
      </Reveal>
    </section>
  )
}
