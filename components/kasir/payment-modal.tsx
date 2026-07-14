'use client'

import { useEffect, useRef, useState } from 'react'
import { cartTotal, computeChange, isSufficient, type CartItem } from '@/lib/cart'
import { formatRupiah } from '@/lib/format'
import { checkoutOrder, type CheckoutResult } from '@/app/(kasir)/kasir/actions'
import { inputClass, labelClass, primaryBtn, secondaryBtn } from '@/components/owner/ui'

type Success = Extract<CheckoutResult, { ok: true }>

export function PaymentModal({
  open,
  items,
  onClose,
  onSuccess,
}: {
  open: boolean
  items: CartItem[]
  onClose: () => void
  onSuccess: (r: Success) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const total = cartTotal(items)
  const paid = amount.trim() === '' ? NaN : Number(amount)
  const validNumber = !Number.isNaN(paid) && paid >= 0
  const sufficient = validNumber && isSufficient(total, paid)
  const change = sufficient ? computeChange(total, paid) : 0

  useEffect(() => {
    if (open) {
      setAmount('')
      setError(null)
      ref.current?.showModal()
    } else {
      ref.current?.close()
    }
  }, [open])

  async function submit() {
    if (!sufficient) {
      setError('Jumlah bayar kurang dari total.')
      return
    }
    setPending(true)
    setError(null)
    const res = await checkoutOrder({
      items: items.map((i) => ({ product_id: i.productId, qty: i.qty })),
      amountPaid: paid,
    })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onSuccess(res)
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[24rem] max-w-[calc(100vw-2rem)] rounded-card bg-white p-0 backdrop:bg-black/40"
    >
      <div className="space-y-4 p-6">
        <h3 className="font-mono text-lg font-semibold text-ink">Konfirmasi Bayar</h3>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">Total</span>
          <span className="font-mono text-2xl font-semibold text-ink">{formatRupiah(total)}</span>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="pay-amount" className={labelClass}>Jumlah bayar (cash)</label>
          <input
            id="pay-amount"
            type="number"
            inputMode="numeric"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className={`${inputClass} font-mono text-lg`}
          />
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">Kembalian</span>
          <span className={`font-mono text-xl ${sufficient ? 'text-stamp-green' : 'text-ink-muted'}`}>
            {sufficient ? formatRupiah(change) : '—'}
          </span>
        </div>

        {error && <p role="alert" aria-live="polite" className="text-sm text-stamp-red">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose} disabled={pending}>
            Batal
          </button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={!sufficient || pending}>
            {pending ? 'Memproses…' : 'Konfirmasi'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
