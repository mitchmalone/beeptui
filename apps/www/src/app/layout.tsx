import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

const SITE_URL = 'https://beeptui.mitchmalone.com'
const TITLE = 'beeptui — your whole inbox, in your terminal'
const DESCRIPTION =
  'A fast, keyboard-first TUI for your Beeper unified inbox. WhatsApp, Slack, Telegram, Signal, Discord and more — read, search and reply without leaving the terminal.'

export const metadata: Metadata = {
  // TODO: set the real domain once live.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: '/',
    // REPLACE: /assets/og.png — 1200×630 social card.
    images: [{ url: '/assets/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@mitchmalone',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/assets/og.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
