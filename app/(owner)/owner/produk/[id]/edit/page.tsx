import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductForm, type ProductValues } from '@/components/owner/product-form'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: product }, { data: ingredientsData }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price, category, image_url, is_active, recipes(ingredient_id, qty_needed)')
      .eq('id', id)
      .single(),
    supabase.from('ingredients').select('id, name, unit').order('name', { ascending: true }),
  ])

  if (!product) notFound()

  const ingredients = (ingredientsData ?? []).map((i) => ({ id: i.id as string, name: i.name as string, unit: i.unit as string }))
  const values: ProductValues = {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    category: product.category ?? '',
    image_url: product.image_url ?? '',
    is_active: product.is_active,
    recipes: (product.recipes ?? []).map((r: { ingredient_id: string; qty_needed: number }) => ({
      ingredient_id: r.ingredient_id,
      qty_needed: Number(r.qty_needed),
    })),
  }

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-2xl font-semibold text-ink">Edit Produk</h1>
      <ProductForm ingredients={ingredients} product={values} />
    </div>
  )
}
