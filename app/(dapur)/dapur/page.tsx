import { createClient } from '@/lib/supabase/server'
import { KdsBoard } from '@/components/kds/kds-board'
import type { KdsOrder, KdsStatus } from '@/lib/queries/kds'

export default async function DapurPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, status, confirmed_at, created_at, order_items(qty, products(name))')
    .in('status', ['confirmed', 'in_kitchen', 'ready'])
    .order('created_at', { ascending: true })

  const initial: KdsOrder[] = (data ?? []).map((o) => ({
    id: o.id as string,
    orderNumber: o.order_number as string,
    status: o.status as KdsStatus,
    confirmedAt: (o.confirmed_at as string | null) ?? null,
    items: ((o.order_items ?? []) as { qty: number; products: { name: string } | { name: string }[] | null }[]).map(
      (it) => {
        const product = Array.isArray(it.products) ? it.products[0] : it.products
        return { qty: Number(it.qty), name: product?.name ?? 'Produk' }
      },
    ),
  }))

  return <KdsBoard initial={initial} />
}
