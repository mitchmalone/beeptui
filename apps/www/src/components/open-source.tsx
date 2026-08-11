'use client'

import { useEffect, useState } from 'react'
import { Star } from '@/components/icons'
import { Reveal } from '@/components/reveal'

function formatStars(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
}

export function OpenSource() {
  const [stars, setStars] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('https://api.github.com/repos/mitchmalone/beeptui')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n = d?.stargazers_count
        if (active && typeof n === 'number' && n > 0) setStars(formatStars(n))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="mx-auto max-w-[1100px] px-6 pt-[100px] pb-[110px]">
      <Reveal className="flex flex-col items-center gap-[18px] text-center">
        <h2 className="font-mono text-sm font-normal text-muted-foreground">
          <span className="text-primary">{'//'}</span> open source
        </h2>
        <p className="max-w-[48ch] text-pretty text-[17px] leading-[1.6] text-foreground">
          Built by <a href="https://x.com/mitchmalone">@mitchmalone</a> because I wanted more of the
          tools I love in the terminal. MIT licensed. Issues and PRs genuinely welcome.
        </p>
        {stars && (
          <span className="inline-flex items-center gap-[7px] rounded-[99px] border border-border px-3.5 py-[5px] font-mono text-[12.5px] text-muted-foreground">
            <Star size={13} className="text-primary" />
            {stars} stars
          </span>
        )}
        <div className="mt-1.5 flex flex-wrap justify-center gap-x-[26px] gap-y-2.5 text-sm">
          <a href="https://github.com/mitchmalone/beeptui">Star on GitHub</a>
          <a href="https://github.com/mitchmalone/beeptui/issues/new">Report an issue</a>
          <a href="https://github.com/mitchmalone/beeptui/blob/main/CONTRIBUTING.md">
            Contributing guide
          </a>
          {/* community link slot — add Discord/Matrix here when one exists:
          <a href="#">Join the community</a> */}
        </div>
      </Reveal>
    </section>
  )
}
