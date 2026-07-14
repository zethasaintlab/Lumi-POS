'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { saveProduct } from '@/app/(owner)/owner/produk/actions'
import { cardClass, inputClass, labelClass, primaryBtn, rowBtn, secondaryBtn } from './ui'

type IngredientOption = { id: string; name: string; unit: string }
type RecipeRow = { ingredient_id: string; qty_needed: number | '' }

export type ProductValues = {
  id?: string
  name: string
  price: number | ''
  category: string
  image_url: string
  is_active: boolean
  recipes: RecipeRow[]
}

const blank: ProductValues = {
  name: '',
  price: '',
  category: '',
  image_url: '',
  is_active: true,
  recipes: [],
}

export function ProductForm({
  ingredients,
  product,
}: {
  ingredients: IngredientOption[]
  product?: ProductValues
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProductValues>({ defaultValues: product ?? blank })
  const { fields, append, remove } = useFieldArray({ control, name: 'recipes' })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    const res = await saveProduct({
      ...values,
      id: values.id || undefined,
      price: Number(values.price),
      recipes: values.recipes.map((r) => ({ ingredient_id: r.ingredient_id, qty_needed: Number(r.qty_needed) })),
    })
    if (res?.error) setServerError(res.error) // success → the action redirects
  })

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <input type="hidden" {...register('id')} />

      <div className={`space-y-4 p-6 ${cardClass}`}>
        <h2 className="font-mono text-lg font-semibold text-ink">{product ? 'Edit Produk' : 'Produk Baru'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="p-name" className={labelClass}>Nama</label>
            <input id="p-name" {...register('name', { required: true })} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="p-price" className={labelClass}>Harga</label>
            <input id="p-price" type="number" step="any" min="0" {...register('price', { required: true, valueAsNumber: true })} className={`${inputClass} font-mono`} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="p-category" className={labelClass}>Kategori (opsional)</label>
            <input id="p-category" {...register('category')} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="p-image" className={labelClass}>URL Gambar (opsional)</label>
            <input id="p-image" {...register('image_url')} placeholder="https://…" className={inputClass} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('is_active')} className="size-4" /> Aktif (terlihat oleh kasir)
        </label>
      </div>

      <div className={`space-y-4 p-6 ${cardClass}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-lg font-semibold text-ink">Resep</h2>
          <button
            type="button"
            className={rowBtn}
            disabled={ingredients.length === 0}
            onClick={() => append({ ingredient_id: ingredients[0]?.id ?? '', qty_needed: '' })}
          >
            + Bahan
          </button>
        </div>

        {ingredients.length === 0 && (
          <p className="text-sm text-stamp-amber">Belum ada bahan baku. Tambahkan di menu Stok dulu untuk membuat resep.</p>
        )}

        {fields.length === 0 && ingredients.length > 0 && (
          <p className="text-sm text-ink-muted">
            Belum ada bahan. Produk tanpa resep tetap bisa dipesan tapi tidak memotong stok (badge &ldquo;stok tidak terlacak&rdquo;).
          </p>
        )}

        {fields.map((field, i) => (
          <div key={field.id} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label htmlFor={`r-ing-${i}`} className={labelClass}>Bahan</label>
              <select id={`r-ing-${i}`} {...register(`recipes.${i}.ingredient_id` as const, { required: true })} className={inputClass}>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                ))}
              </select>
            </div>
            <div className="w-28 space-y-1.5">
              <label htmlFor={`r-qty-${i}`} className={labelClass}>Qty</label>
              <input id={`r-qty-${i}`} type="number" step="any" min="0" {...register(`recipes.${i}.qty_needed` as const, { required: true, valueAsNumber: true })} className={`${inputClass} font-mono`} />
            </div>
            <button type="button" className={`${rowBtn} text-stamp-red`} onClick={() => remove(i)}>Hapus</button>
          </div>
        ))}
      </div>

      {serverError && <p role="alert" aria-live="polite" className="text-sm text-stamp-red">{serverError}</p>}

      <div className="flex gap-2">
        <Link href="/owner/produk" className={secondaryBtn}>Batal</Link>
        <button type="submit" disabled={isSubmitting} className={primaryBtn}>
          {isSubmitting ? 'Menyimpan…' : 'Simpan Produk'}
        </button>
      </div>
    </form>
  )
}
