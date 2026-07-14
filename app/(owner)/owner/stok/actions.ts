'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOwner } from '@/lib/auth/guards'

export type StokState = { error?: string; ok?: boolean }

/** '' / null → undefined (so optional fields work and required ones fail);
 *  non-numeric → NaN (which Zod's z.number() rejects). */
function num(v: FormDataEntryValue | null): number | undefined {
  if (v === null) return undefined
  const s = String(v).trim()
  if (s === '') return undefined
  return Number(s)
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  unit: z.string().trim().min(1, 'Satuan wajib diisi (mis. ml, gram, pcs).'),
  current_stock: z.number({ error: 'Stok awal harus angka.' }).min(0, 'Stok tidak boleh negatif.'),
  min_stock_threshold: z.number({ error: 'Ambang harus angka.' }).min(0, 'Ambang tidak boleh negatif.').optional(),
})

export async function createIngredient(_prev: StokState, formData: FormData): Promise<StokState> {
  const { supabase } = await requireOwner()
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    unit: formData.get('unit'),
    current_stock: num(formData.get('current_stock')),
    min_stock_threshold: num(formData.get('min_stock_threshold')),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }

  const { name, unit, current_stock } = parsed.data
  // Default threshold = 20% of initial stock (FR-6), owner can override.
  const min_stock_threshold = parsed.data.min_stock_threshold ?? Number((current_stock * 0.2).toFixed(3))

  const { error } = await supabase.from('ingredients').insert({ name, unit, current_stock, min_stock_threshold })
  if (error) return { error: error.message }
  revalidatePath('/owner/stok')
  return { ok: true }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  unit: z.string().trim().min(1, 'Satuan wajib diisi.'),
  min_stock_threshold: z.number({ error: 'Ambang harus angka.' }).min(0, 'Ambang tidak boleh negatif.'),
})

// Deliberately does NOT touch current_stock — that only changes via the
// restock/adjust RPCs (Aturan Keras #1).
export async function updateIngredient(_prev: StokState, formData: FormData): Promise<StokState> {
  const { supabase } = await requireOwner()
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    unit: formData.get('unit'),
    min_stock_threshold: num(formData.get('min_stock_threshold')),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }

  const { id, name, unit, min_stock_threshold } = parsed.data
  const { error } = await supabase.from('ingredients').update({ name, unit, min_stock_threshold }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/owner/stok')
  return { ok: true }
}

export async function restockIngredient(_prev: StokState, formData: FormData): Promise<StokState> {
  const { supabase } = await requireOwner()
  const id = formData.get('id')
  const qty = num(formData.get('qty'))
  if (typeof id !== 'string' || qty === undefined || Number.isNaN(qty) || qty <= 0) {
    return { error: 'Jumlah restock harus lebih dari 0.' }
  }
  const { error } = await supabase.rpc('restock_ingredient', { p_ingredient_id: id, p_qty: qty })
  if (error) return { error: error.message }
  revalidatePath('/owner/stok')
  return { ok: true }
}

export async function adjustIngredientStock(_prev: StokState, formData: FormData): Promise<StokState> {
  const { supabase } = await requireOwner()
  const id = formData.get('id')
  const newStock = num(formData.get('new_stock'))
  if (typeof id !== 'string' || newStock === undefined || Number.isNaN(newStock) || newStock < 0) {
    return { error: 'Stok baru tidak boleh negatif.' }
  }
  const { error } = await supabase.rpc('adjust_ingredient_stock', { p_ingredient_id: id, p_new_stock: newStock })
  if (error) return { error: error.message }
  revalidatePath('/owner/stok')
  return { ok: true }
}

export async function deleteIngredient(_prev: StokState, formData: FormData): Promise<StokState> {
  const { supabase } = await requireOwner()
  const id = formData.get('id')
  if (typeof id !== 'string') return { error: 'Bahan baku tidak valid.' }
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) {
    // 23503 = FK violation: ingredient still referenced by a recipe (ON DELETE RESTRICT).
    if (error.code === '23503') return { error: 'Bahan baku dipakai di resep, tidak bisa dihapus.' }
    return { error: error.message }
  }
  revalidatePath('/owner/stok')
  return { ok: true }
}
