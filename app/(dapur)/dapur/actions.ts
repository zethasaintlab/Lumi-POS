'use server'

import { z } from 'zod'
import { requireDapur } from '@/lib/auth/guards'

const NEXT = {
  confirmed: 'in_kitchen',
  in_kitchen: 'ready',
  ready: 'completed',
} as const

const schema = z.object({
  orderId: z.string().uuid(),
  from: z.enum(['confirmed', 'in_kitchen', 'ready']),
})

export type AdvanceResult = { ok: true } | { ok: false; error: string }

/** Advance an order one step forward. The target is derived server-side from the
 *  current status (client can't pick an arbitrary target); dapur RLS is the
 *  backstop, and .eq('status', from) makes it a no-op if another device already
 *  advanced it. completed_at is set by the DB trigger. */
export async function advanceOrder(input: { orderId: string; from: string }): Promise<AdvanceResult> {
  const { supabase } = await requireDapur()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Data tidak valid.' }

  const to = NEXT[parsed.data.from]
  const { error } = await supabase
    .from('orders')
    .update({ status: to })
    .eq('id', parsed.data.orderId)
    .eq('status', parsed.data.from)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
