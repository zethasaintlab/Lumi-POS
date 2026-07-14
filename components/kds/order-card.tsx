'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { advanceOrder } from '@/app/(dapur)/dapur/actions'
import { primaryBtn } from '@/components/owner/ui'
import type { KdsOrder } from '@/lib/queries/kds'

const NEXT_LABEL: Record<KdsOrder['status'], string> = {
  confirmed: 'Mulai Masak',
  in_kitchen: 'Siap',
  ready: 'Selesai',
}

/** Elapsed minutes since confirmedAt. null until mounted to avoid an SSR/client
 *  hydration mismatch on the clock. Turns amber after 10 minutes (design). */
function useElapsed(fromIso: string | null) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  if (now === null || !fromIso) return { text: '—', overdue: false }
  const mins = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000))
  return { text: `${mins} mnt`, overdue: mins >= 10 }
}

export function OrderCard({ order }: { order: KdsOrder }) {
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)
  const elapsed = useElapsed(order.confirmedAt)

  async function advance() {
    setPending(true)
    await advanceOrder({ orderId: order.id, from: order.status })
    setPending(false)
    // Immediate local update; other devices update via realtime.
    qc.invalidateQueries({ queryKey: ['orders', 'kds'] })
  }

  return (
    <article className="rounded-card border-t-2 border-dashed border-ink/25 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xl font-semibold text-ink">{order.orderNumber}</span>
        <span className={`font-mono text-sm ${elapsed.overdue ? 'text-stamp-amber' : 'text-ink-muted'}`}>
          {elapsed.text}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {order.items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink">
            <span className="font-mono text-ink-muted">{it.qty}×</span>
            <span>{it.name}</span>
          </li>
        ))}
      </ul>

      <button onClick={advance} disabled={pending} className={`${primaryBtn} mt-4 w-full text-base`}>
        {pending ? '…' : NEXT_LABEL[order.status]}
      </button>
    </article>
  )
}
