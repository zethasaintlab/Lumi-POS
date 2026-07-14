import { createClient } from '@/lib/supabase/server'
import { KasirScreen } from '@/components/kasir/kasir-screen'

export default async function KasirPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, price, category')
    .eq('is_active', true)
    .order('name', { ascending: true })

  const products = (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    price: Number(p.price),
    category: (p.category as string | null) ?? null,
  }))

  return <KasirScreen products={products} />
}
