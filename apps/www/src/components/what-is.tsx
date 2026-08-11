import { Reveal } from '@/components/reveal'

export function WhatIs() {
  return (
    <section className="relative border-t border-border bg-background">
      <Reveal className="mx-auto flex max-w-[1100px] flex-col items-center gap-5 px-6 pt-[130px] pb-10 text-center">
        <h2 className="font-mono text-sm font-normal text-muted-foreground">
          <span className="text-primary">{'//'}</span> what is beeptui
        </h2>
        <p className="max-w-[56ch] text-pretty text-[clamp(18px,2.4vw,23px)] leading-[1.55]">
          beeptui is a terminal client for the{' '}
          <a href="https://developers.beeper.com">Beeper Desktop API</a> running on your own
          machine. Beeper stays the account, sync and encryption boundary — beeptui is just a fast,
          keyboard-first window into it. Not a bridge, not a Matrix client, not another messaging
          service.
        </p>
      </Reveal>
    </section>
  )
}
