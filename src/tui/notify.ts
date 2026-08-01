import type { NotifyConfig } from '@/beeper/config.ts'
import type { MessageSummary } from '@/beeper/types.ts'

/**
 * Notification hooks: run a user-configured command when a new inbound
 * message arrives in a chat you're not currently reading. The payload is
 * deliberately redacted — the app name and the network only, never the sender,
 * chat title, or message text (invariant 6). The command runs argv-free (arg
 * array, no shell) at the launch layer; this module is the pure decision + args.
 */

/** The redacted notification line. Network is a platform name (WhatsApp/Slack),
 *  not content or a contact — safe to surface. */
export function notificationText(network: string): string {
  return `beeper-tui: new message on ${network}`
}

/**
 * Whether an inbound message should fire a notification: it must be inbound (not
 * our own send) and belong to a chat other than the one currently focused (no
 * ping for the conversation you're actively reading).
 */
export function shouldNotify(
  message: Pick<MessageSummary, 'isSender' | 'chatId'>,
  focusedChatId: string | null
): boolean {
  if (message.isSender) return false
  return message.chatId !== focusedChatId
}

/** The full command line to spawn: the configured command plus the redacted
 *  summary as a final argument. */
export function buildNotifyArgs(config: NotifyConfig, network: string): string[] {
  return [...config.command, notificationText(network)]
}
