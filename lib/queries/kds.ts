'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type KdsStatus = 'confirmed' | 'in_kitchen' | 'ready'

export type KdsOrder = {
  id: string
  orderNumber: string
  status: KdsStatus
  confirmedAt: string | null
  items: { qty: number; name: string }[]
}

const KDS_KEY = ['orders', 'kds'] as const
const SELECT = 'id, order_number, status, confirmed_at, created_at, order_items(qty, products(name))'

function mapOrder(o: Record<string, unknown>): KdsOrder {
  const rawItems = (o.order_items ?? []) as {
    qty: number
    products: { name: string } | { name: string }[] | null
  }[]
  const items = rawItems.map((it) => {
    const product = Array.isArray(it.products) ? it.products[0] : it.products
    return { qty: Number(it.qty), name: product?.name ?? 'Produk' }
  })
  return {
    id: o.id as string,
    orderNumber: o.order_number as string,
    status: o.status as KdsStatus,
    confirmedAt: (o.confirmed_at as string | null) ?? null,
    items,
  }
}

/** Board query — the single source of truth. Realtime only signals it to refetch. */
export function useKdsOrders(initial: KdsOrder[]) {
  return useQuery({
    queryKey: KDS_KEY,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('orders')
        .select(SELECT)
        .in('status', ['confirmed', 'in_kitchen', 'ready'])
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map(mapOrder)
    },
    initialData: initial,
    staleTime: 0,
  })
}

/** Subscribe to orders changes; each event just invalidates the board query
 *  (Aturan Keras #5 — event is a signal, never a data source). On every
 *  (re)subscribe — initial connect and after an auto-reconnect — invalidate for
 *  a full resync, so orders confirmed while offline aren't lost. */
export function useKdsRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const supabase = createClient()
    const invalidate = () => qc.invalidateQueries({ queryKey: KDS_KEY })
    const channel = supabase
      .channel('orders-kds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidate)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') invalidate()
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}
