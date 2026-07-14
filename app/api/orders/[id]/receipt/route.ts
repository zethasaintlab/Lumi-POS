import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { receiptDocument } from '@/components/receipt/receipt-document'

// @react-pdf needs the Node runtime; the PDF is generated on demand (FR-13).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Self-guard: proxy doesn't role-check /api/*, so verify staff here.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'kasir' && profile?.role !== 'owner') {
    return new Response('Forbidden', { status: 403 })
  }

  // Admin read so product names resolve even if a product was later deactivated.
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select(
      'order_number, total, amount_paid, change_amount, payment_method, confirmed_at, status, order_items(qty, price_at_order_time, products(name))',
    )
    .eq('id', id)
    .single()

  if (!order || order.status !== 'confirmed') {
    return new Response('Order tidak ditemukan', { status: 404 })
  }

  // PostgREST returns the to-one `products` embed as an object; supabase-js types
  // it as an array — handle both.
  const items = ((order.order_items ?? []) as unknown[]).map((raw) => {
    const it = raw as { qty: number; price_at_order_time: number; products: { name: string } | { name: string }[] | null }
    const product = Array.isArray(it.products) ? it.products[0] : it.products
    return {
      name: product?.name ?? 'Produk',
      qty: Number(it.qty),
      price: Number(it.price_at_order_time),
    }
  })

  const buffer = await renderToBuffer(
    receiptDocument({
      orderNumber: order.order_number,
      createdAt: order.confirmed_at ? new Date(order.confirmed_at).toLocaleString('id-ID') : '',
      paymentMethod: order.payment_method,
      total: Number(order.total),
      amountPaid: Number(order.amount_paid),
      change: Number(order.change_amount),
      items,
    }),
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="struk-${order.order_number}.pdf"`,
    },
  })
}
