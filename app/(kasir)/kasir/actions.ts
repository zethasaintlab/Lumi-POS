'use server'

import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'

const schema = z.object({
  items: z
    .array(z.object({ product_id: z.string().uuid(), qty: z.number().int().positive() }))
    .min(1, 'Order kosong.'),
  amountPaid: z.number().nonnegative(),
})

export type CheckoutResult =
  | { ok: true; orderId: string; orderNumber: string; total: number; change: number }
  | { ok: false; error: string }

export async function checkoutOrder(input: {
  items: { product_id: string; qty: number }[]
  amountPaid: number
}): Promise<CheckoutResult> {
  const { supabase } = await requireStaff()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }

  // All persistence + atomic stock deduction happens inside checkout_order → confirm_order.
  const { data, error } = await supabase.rpc('checkout_order', {
    p_items: parsed.data.items,
    p_amount_paid: parsed.data.amountPaid,
  })
  if (error) return { ok: false, error: error.message }

  const order = Array.isArray(data) ? data[0] : data
  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.order_number,
    total: Number(order.total),
    change: Number(order.change_amount),
  }
}
