// Stamp-style status badge (design-system §badge: "cap stempel", slight 1-2° tilt,
// outline not filled pill). Server-safe (no client hooks).
type Tone = 'amber' | 'red' | 'green' | 'muted'

const toneClass: Record<Tone, string> = {
  amber: 'border-stamp-amber/50 text-stamp-amber',
  red: 'border-stamp-red/50 text-stamp-red',
  green: 'border-stamp-green/50 text-stamp-green',
  muted: 'border-ink-muted/40 text-ink-muted',
}

export function StampBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block -rotate-1 rounded-input border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${toneClass[tone]}`}
    >
      {children}
    </span>
  )
}
