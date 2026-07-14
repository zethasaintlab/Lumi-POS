'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createIngredient, type StokState } from '@/app/(owner)/owner/stok/actions'
import { cardClass, inputClass, labelClass, primaryBtn } from './ui'

const initial: StokState = {}

export function IngredientForm() {
  const [state, formAction, pending] = useActionState(createIngredient, initial)
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) ref.current?.reset()
  }, [state.ok])

  return (
    <form ref={ref} action={formAction} className={`space-y-4 p-6 ${cardClass}`}>
      <h2 className="font-mono text-lg font-semibold text-ink">Tambah Bahan Baku</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="ing-name" className={labelClass}>Nama</label>
          <input id="ing-name" name="name" required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ing-unit" className={labelClass}>Satuan (ml, gram, pcs)</label>
          <input id="ing-unit" name="unit" required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ing-stock" className={labelClass}>Stok awal</label>
          <input id="ing-stock" name="current_stock" type="number" step="any" min="0" required className={`${inputClass} font-mono`} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ing-threshold" className={labelClass}>Ambang stok menipis (opsional)</label>
          <input id="ing-threshold" name="min_stock_threshold" type="number" step="any" min="0" placeholder="default 20% stok awal" className={`${inputClass} font-mono`} />
        </div>
      </div>

      {state.error && <p role="alert" aria-live="polite" className="text-sm text-stamp-red">{state.error}</p>}
      {state.ok && <p role="status" aria-live="polite" className="text-sm text-stamp-green">Bahan baku ditambahkan.</p>}

      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? 'Menyimpan…' : 'Simpan'}
      </button>
    </form>
  )
}
