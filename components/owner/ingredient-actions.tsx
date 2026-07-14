'use client'

import { useActionState, useEffect, useRef } from 'react'
import {
  restockIngredient,
  adjustIngredientStock,
  updateIngredient,
  deleteIngredient,
  type StokState,
} from '@/app/(owner)/owner/stok/actions'
import { inputClass, labelClass, rowBtn, primaryBtn, secondaryBtn } from './ui'

export type Ingredient = {
  id: string
  name: string
  unit: string
  current_stock: number
  min_stock_threshold: number
}

const initial: StokState = {}

function DialogForm({
  triggerLabel,
  triggerClass,
  title,
  action,
  submitLabel,
  children,
}: {
  triggerLabel: string
  triggerClass?: string
  title: string
  action: (prev: StokState, fd: FormData) => Promise<StokState>
  submitLabel: string
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, initial)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (state.ok) ref.current?.close()
  }, [state.ok])

  return (
    <>
      <button type="button" className={triggerClass ?? rowBtn} onClick={() => ref.current?.showModal()}>
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-card bg-white p-0 backdrop:bg-black/40"
      >
        <form action={formAction} className="space-y-4 p-6">
          <h3 className="font-mono text-base font-semibold text-ink">{title}</h3>
          {children}
          {state.error && <p role="alert" aria-live="polite" className="text-sm text-stamp-red">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => ref.current?.close()}>
              Batal
            </button>
            <button type="submit" disabled={pending} className={primaryBtn}>
              {pending ? '…' : submitLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}

export function IngredientActions({ ingredient }: { ingredient: Ingredient }) {
  const idp = ingredient.id
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <DialogForm triggerLabel="Restock" title={`Restock ${ingredient.name}`} action={restockIngredient} submitLabel="Restock">
        <input type="hidden" name="id" value={ingredient.id} />
        <div className="space-y-1.5">
          <label htmlFor={`restock-${idp}`} className={labelClass}>Tambah jumlah ({ingredient.unit})</label>
          <input id={`restock-${idp}`} name="qty" type="number" step="any" min="0" required className={`${inputClass} font-mono`} />
        </div>
      </DialogForm>

      <DialogForm triggerLabel="Sesuaikan" title={`Sesuaikan stok ${ingredient.name}`} action={adjustIngredientStock} submitLabel="Simpan">
        <input type="hidden" name="id" value={ingredient.id} />
        <div className="space-y-1.5">
          <label htmlFor={`adjust-${idp}`} className={labelClass}>Stok sebenarnya ({ingredient.unit})</label>
          <input id={`adjust-${idp}`} name="new_stock" type="number" step="any" min="0" required defaultValue={ingredient.current_stock} className={`${inputClass} font-mono`} />
        </div>
      </DialogForm>

      <DialogForm triggerLabel="Edit" title={`Edit ${ingredient.name}`} action={updateIngredient} submitLabel="Simpan">
        <input type="hidden" name="id" value={ingredient.id} />
        <div className="space-y-1.5">
          <label htmlFor={`name-${idp}`} className={labelClass}>Nama</label>
          <input id={`name-${idp}`} name="name" defaultValue={ingredient.name} required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`unit-${idp}`} className={labelClass}>Satuan</label>
          <input id={`unit-${idp}`} name="unit" defaultValue={ingredient.unit} required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`thr-${idp}`} className={labelClass}>Ambang stok menipis</label>
          <input id={`thr-${idp}`} name="min_stock_threshold" type="number" step="any" min="0" defaultValue={ingredient.min_stock_threshold} required className={`${inputClass} font-mono`} />
        </div>
        <p className="text-xs text-ink-muted">Stok saat ini hanya bisa diubah lewat Restock / Sesuaikan.</p>
      </DialogForm>

      <DialogForm triggerLabel="Hapus" triggerClass={`${rowBtn} text-stamp-red`} title={`Hapus ${ingredient.name}?`} action={deleteIngredient} submitLabel="Hapus">
        <input type="hidden" name="id" value={ingredient.id} />
        <p className="text-sm text-ink-muted">Bahan baku yang masih dipakai di resep tidak bisa dihapus.</p>
      </DialogForm>
    </div>
  )
}
