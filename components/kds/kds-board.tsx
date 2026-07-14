'use client'

import { signOut } from '@/lib/actions/auth'
import { secondaryBtn } from '@/components/owner/ui'
import { useKdsOrders, useKdsRealtime, type KdsOrder, type KdsStatus } from '@/lib/queries/kds'
import { OrderCard } from './order-card'

const COLUMNS: { status: KdsStatus; title: string }[] = [
  { status: 'confirmed', title: 'Diterima' },
  { status: 'in_kitchen', title: 'Sedang Dimasak' },
  { status: 'ready', title: 'Siap Diambil' },
]

export function KdsBoard({ initial }: { initial: KdsOrder[] }) {
  useKdsRealtime()
  const { data: orders } = useKdsOrders(initial)

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-paper px-4 py-3">
        <h1 className="font-mono text-lg font-semibold text-ink">KDS Board</h1>
        <form action={signOut}>
          <button className={secondaryBtn}>Keluar</button>
        </form>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colOrders = (orders ?? []).filter((o) => o.status === col.status)
          return (
            <section key={col.status} className="space-y-3">
              <h2 className="flex items-center justify-between text-sm font-semibold text-ink">
                <span>{col.title}</span>
                <span className="font-mono text-xs text-ink-muted">{colOrders.length}</span>
              </h2>
              {colOrders.length === 0 ? (
                <p className="rounded-card border border-dashed border-black/10 p-6 text-center text-sm text-ink-muted">
                  Belum ada order
                </p>
              ) : (
                colOrders.map((o) => <OrderCard key={o.id} order={o} />)
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
