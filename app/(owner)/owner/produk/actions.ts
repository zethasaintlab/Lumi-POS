'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOwner } from '@/lib/auth/guards'

const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'Nama produk wajib diisi.'),
    price: z.number({ error: 'Harga harus angka.' }).min(0, 'Harga tidak boleh negatif.'),
    category: z.string().trim().optional().or(z.literal('')),
    image_url: z.string().url('URL gambar tidak valid.').optional().or(z.literal('')),
    is_active: z.boolean(),
    recipes: z.array(
      z.object({
        ingredient_id: z.string().uuid('Bahan baku belum dipilih.'),
        qty_needed: z.number({ error: 'Qty resep harus angka.' }).positive('Qty resep harus lebih dari 0.'),
      }),
    ),
  })
  .refine(
    (p) => new Set(p.recipes.map((r) => r.ingredient_id)).size === p.recipes.length,
    { message: 'Bahan baku tidak boleh dobel dalam satu resep.', path: ['recipes'] },
  )

export async function saveProduct(payload: unknown): Promise<{ error?: string }> {
  const { supabase } = await requireOwner()
  const parsed = productSchema.safeParse(payload)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }

  const { id, name, price, category, image_url, is_active, recipes } = parsed.data
  const row = { name, price, category: category || null, image_url: image_url || null, is_active }

  let productId = id
  if (id) {
    const { error } = await supabase.from('products').update(row).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await supabase.from('products').insert(row).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Gagal menyimpan produk.' }
    productId = data.id
  }

  // Atomic recipe replace (avoids half-applied recipe edits).
  const { error: recipeError } = await supabase.rpc('set_product_recipes', {
    p_product_id: productId,
    p_items: recipes,
  })
  if (recipeError) return { error: recipeError.message }

  revalidatePath('/owner/produk')
  redirect('/owner/produk')
}

export async function setProductActive(id: string, isActive: boolean) {
  const { supabase } = await requireOwner()
  await supabase.from('products').update({ is_active: isActive }).eq('id', id)
  revalidatePath('/owner/produk')
}
