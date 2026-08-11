import type { ComponentType, ReactNode } from 'react'
import {
  GitBranch,
  ImageIcon,
  Keyboard,
  LayoutPanelLeft,
  Lock,
  MessageSquareReply,
  Save,
  Stethoscope,
  Terminal,
  Zap,
} from '@/components/icons'
import { DemoVideo } from '@/components/demo-video'
import { Kbd } from '@/components/kbd'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/utils'

type IconType = ComponentType<{ size?: number; className?: string }>

function FeatureRow({
  icon: Icon,
  title,
  children,
  media,
  mediaLabel,
  mediaAlt,
  mediaFirst = false,
}: {
  icon: IconType
  title: string
  children: ReactNode
  /** Base name of a clip in /public/demo; omit to render the dashed placeholder. */
  media?: string
  mediaLabel: string
  mediaAlt: string
  mediaFirst?: boolean
}) {
  return (
    <Reveal className="mb-[88px] grid grid-cols-1 items-center gap-10 md:grid-cols-2">
      <div className={cn('flex max-w-[44ch] flex-col gap-3.5', mediaFirst && 'order-2')}>
        <span className="text-primary">
          <Icon size={24} />
        </span>
        <h3 className="text-[24px] font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="text-[15.5px] leading-[1.6] text-muted-foreground">{children}</p>
      </div>
      {media ? (
        <DemoVideo
          name={media}
          label={mediaAlt}
          className={cn('rounded-[10px] border border-border', mediaFirst && 'order-1')}
        />
      ) : (
        <div
          role="img"
          aria-label={mediaAlt}
          className={cn(
            'flex aspect-[16/10] items-center justify-center rounded-[10px] border border-dashed border-border bg-card',
            mediaFirst && 'order-1'
          )}
        >
          <span className="px-6 text-center font-mono text-[12px] text-muted-foreground">
            {mediaLabel}
          </span>
        </div>
      )}
    </Reveal>
  )
}

const CARDS: { icon: IconType; title: string; mono?: boolean; body: string }[] = [
  {
    icon: MessageSquareReply,
    title: 'Replies, reactions, edits',
    body: 'Threaded replies, reactions, edits and read receipts — sent for real.',
  },
  {
    icon: Save,
    title: 'Drafts that survive',
    body: 'Compose is persisted as you type. A crash never eats a message.',
  },
  {
    icon: Lock,
    title: 'Local and private',
    body: 'Talks only to your own Beeper endpoint. No telemetry. Tokens live in the OS keychain, never a config file.',
  },
  {
    icon: Terminal,
    title: 'tmux and SSH friendly',
    body: 'Behaves in a pane, with an unread indicator for your status bar.',
  },
  {
    icon: GitBranch,
    title: 'Themeable, rebindable',
    body: 'Per-network accent colours, custom keybinds, comfortable or compact density.',
  },
  {
    icon: Stethoscope,
    title: 'doctor',
    mono: true,
    body: 'One command checks your endpoint, token and terminal before first run.',
  },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1100px] px-6 pt-20 pb-8">
      <Reveal as="h2" className="mb-14 font-mono text-sm font-normal text-muted-foreground">
        <span className="text-primary">{'//'}</span> why you&apos;d want it
      </Reveal>

      <FeatureRow
        icon={LayoutPanelLeft}
        title="One inbox, every network"
        media="rail"
        mediaLabel="demo — network rail, cycling accounts"
        mediaAlt="beeptui cycling the network rail: the inbox filters from all networks down to WhatsApp, Slack, Telegram and Signal in turn"
      >
        WhatsApp, Slack, Telegram, Signal, Discord, Instagram and X DMs in a single rail. Cycle
        networks with <Kbd>[</Kbd> and <Kbd>]</Kbd> — one keyboard for all of it.
      </FeatureRow>

      <FeatureRow
        icon={Zap}
        title="Live, without a refresh key"
        media="live"
        mediaLabel="demo — message arriving live, scroll held"
        mediaAlt="beeptui receiving two live messages in an open chat; the scroll position holds and nothing flickers"
        mediaFirst
      >
        WebSocket updates land while you read. Your scroll position holds, your draft survives,
        nothing flickers. It just stays current, the way a chat client should.
      </FeatureRow>

      <FeatureRow
        icon={ImageIcon}
        title="Photos, right in the flow"
        media="images"
        mediaLabel="demo — inline image thumbnails in a photo-heavy chat"
        mediaAlt="beeptui rendering a photo-heavy chat as inline half-block thumbnails, a new photo arriving live, and the action menu offering Open attachment"
      >
        Image attachments render inline as chunky half-block thumbnails — in any terminal, tmux
        included, no graphics protocol required. Enough to know which photo is which; <Kbd>o</Kbd>{' '}
        (or the <Kbd>⏎</Kbd> menu) opens the real thing in your viewer.
      </FeatureRow>

      <FeatureRow
        icon={Keyboard}
        title="Everything is a keystroke"
        media="keys"
        mediaLabel="demo — help overlay, fuzzy search, message search"
        mediaAlt="beeptui's help overlay listing every keybinding, then the fuzzy chat filter and a message search returning a result"
      >
        <Kbd>?</Kbd> opens the help overlay. <Kbd>/</Kbd> fuzzy-filters the inbox, <Kbd>S</Kbd>{' '}
        searches history, <Kbd>U</Kbd> shows unread only. <Kbd>q</Kbd> quits, like it should.
      </FeatureRow>

      <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ icon: Icon, title, mono, body }) => (
          <div
            key={title}
            className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-[22px]"
          >
            <span className="text-muted-foreground">
              <Icon size={20} />
            </span>
            <h3 className={cn('text-[15px] font-semibold', mono && 'font-mono')}>{title}</h3>
            <p className="text-[14px] leading-[1.55] text-muted-foreground">{body}</p>
          </div>
        ))}
      </Reveal>
    </section>
  )
}
