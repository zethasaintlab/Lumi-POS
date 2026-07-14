import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/owner/product-form'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('ingredients').select('id, name, unit').order('name', { ascending: true })
  const ingredients = (data ?? []).map((i) => ({ id: i.id as string, name: i.name as string, unit: i.unit as string }))

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-2xl font-semibold text-ink">Produk Baru</h1>
      <ProductForm ingredients={ingredients} />
    </div>
  )
}
