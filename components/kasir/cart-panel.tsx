'use client'

import { cartTotal, type CartItem } from '@/lib/cart'
import { formatRupiah } from '@/lib/format'
import { primaryBtn, secondaryBtn } from '@/components/owner/ui'

export function CartPanel({
  items,
  onInc,
  onDec,
  onVoid,
  onPay,
}: {
  items: CartItem[]
  onInc: (id: string) => void
  onDec: (id: string) => void
  onVoid: () => void
  onPay: () => void
}) {
  const total = cartTotal(items)
  const empty = items.length === 0

  return (
    <aside className="flex flex-col gap-3 rounded-card border border-black/10 bg-white p-4 md:sticky md:top-20 md:w-80 md:self-start max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:max-h-[65vh] max-md:rounded-b-none max-md:shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
      <h2 className="font-mono text-sm font-semibold text-ink">Order Berjalan</h2>

      <div className="flex-1 space-y-2 overflow-auto max-md:max-h-[32vh]">
        {empty ? (
          <p className="py-4 text-center text-sm text-ink-muted">Keranjang kosong. Tap produk untuk menambah.</p>
        ) : (
          items.map((i) => (
            <div key={i.productId} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{i.name}</p>
                <p className="font-mono text-xs text-ink-muted">{formatRupiah(i.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onDec(i.productId)} aria-label="Kurangi" className="size-9 rounded-btn border border-ink-muted/40 text-lg leading-none text-ink hover:bg-black/5">
                  −
                </button>
                <span className="w-6 text-center font-mono text-sm text-ink">{i.qty}</span>
                <button type="button" onClick={() => onInc(i.productId)} aria-label="Tambah" className="size-9 rounded-btn border border-ink-muted/40 text-lg leading-none text-ink hover:bg-black/5">
                  +
                </button>
              </div>
              <span className="w-20 text-right font-mono text-sm text-ink">{formatRupiah(i.price * i.qty)}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-black/10 pt-3">
        <span className="text-sm text-ink-muted">Total</span>
        <span className="font-mono text-xl font-semibold text-ink">{formatRupiah(total)}</span>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onVoid} disabled={empty} className={`${secondaryBtn} flex-1 disabled:opacity-50`}>
          Void
        </button>
        <button type="button" onClick={onPay} disabled={empty} className={`${primaryBtn} flex-1 text-base disabled:opacity-50`}>
          Bayar
        </button>
      </div>
    </aside>
  )
}
