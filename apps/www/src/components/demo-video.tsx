import { cn } from '@/lib/utils'

/**
 * A looping, muted demo clip recorded from `beeptui --demo` by the VHS tapes
 * in `demo/` (see demo/README.md). Assets live in /public/demo.
 */
export function DemoVideo({
  name,
  label,
  poster = false,
  className,
}: {
  /** Base filename of the clip in /public/demo (expects .webm + .mp4). */
  name: string
  /** Accessible description of what the clip shows. */
  label: string
  /** Whether /public/demo/{name}.png exists to use as a poster frame. */
  poster?: boolean
  className?: string
}) {
  return (
    <video
      aria-label={label}
      className={cn('block w-full', className)}
      autoPlay
      loop
      muted
      playsInline
      {...(poster ? { poster: `/demo/${name}.png` } : {})}
    >
      <source src={`/demo/${name}.webm`} type="video/webm" />
      <source src={`/demo/${name}.mp4`} type="video/mp4" />
    </video>
  )
}
