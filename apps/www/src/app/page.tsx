import { DocsStrip } from '@/components/docs-strip'
import { Features } from '@/components/features'
import { Hero } from '@/components/hero'
import { Install } from '@/components/install'
import { OpenSource } from '@/components/open-source'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { WhatIs } from '@/components/what-is'

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <WhatIs />
        <Features />
        <Install />
        <DocsStrip />
        <OpenSource />
      </main>
      <SiteFooter />
    </>
  )
}
