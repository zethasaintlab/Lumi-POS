'use client'

import { useState } from 'react'
import { useCart } from '@/lib/stores/cart'
import { formatRupiah } from '@/lib/format'
import { signOut } from '@/lib/actions/auth'
import { primaryBtn, secondaryBtn } from '@/components/owner/ui'
import type { CheckoutResult } from '@/app/(kasir)/kasir/actions'
import { ProductGrid, type KasirProduct } from './product-grid'
import { CartPanel } from './cart-panel'
import { PaymentModal } from './payment-modal'

type Receipt = Extract<CheckoutResult, { ok: true }>

export function KasirScreen({ products }: { products: KasirProduct[] }) {
  const { items, add, inc, dec, clear } = useCart()
  const [payOpen, setPayOpen] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  function handleSuccess(r: Receipt) {
    clear()
    setPayOpen(false)
    setReceipt(r)
  }

  if (receipt) {
    return <SuccessPanel receipt={receipt} onNew={() => setReceipt(null)} />
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-paper px-4 py-3">
        <h1 className="font-mono text-lg font-semibold text-ink">Layar Kasir</h1>
        <form action={signOut}>
          <button className={secondaryBtn}>Keluar</button>
        </form>
      </header>

      <div className="mx-auto max-w-6xl gap-6 p-4 md:flex md:items-start">
        <div className="pb-56 md:flex-1 md:pb-0">
          <ProductGrid products={products} onAdd={(p) => add({ productId: p.id, name: p.name, price: p.price })} />
        </div>
        <CartPanel items={items} onInc={inc} onDec={dec} onVoid={clear} onPay={() => setPayOpen(true)} />
      </div>

      <PaymentModal open={payOpen} items={items} onClose={() => setPayOpen(false)} onSuccess={handleSuccess} />
    </div>
  )
}

function SuccessPanel({ receipt, onNew }: { receipt: Receipt; onNew: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-black/5 bg-white p-8 text-center">
        <p className="text-sm text-ink-muted">Order dikonfirmasi</p>
        <p className="font-mono text-3xl font-semibold text-ink">{receipt.orderNumber}</p>
        <div className="space-y-1 border-y border-black/10 py-3">
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Total</span>
            <span className="font-mono text-ink">{formatRupiah(receipt.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Kembalian</span>
            <span className="font-mono text-lg text-stamp-green">{formatRupiah(receipt.change)}</span>
          </div>
        </div>
        <a
          href={`/api/orders/${receipt.orderId}/receipt`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${secondaryBtn} w-full`}
        >
          Unduh Struk
        </a>
        <button type="button" className={`${primaryBtn} w-full`} onClick={onNew}>
          Order Baru
        </button>
      </div>
    </div>
  )
}
