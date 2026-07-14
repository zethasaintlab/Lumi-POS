'use server'

import { z } from 'zod'
import { requireDapur } from '@/lib/auth/guards'

const schema = z.object({ orderId: z.string().uuid() })

export type AdvanceResult = { ok: true } | { ok: false; error: string }

/** Advance an order one step forward via the advance_order RPC (SECURITY DEFINER
 *  — the target is derived server-side and RLS visibility is bypassed so a
 *  completed order, which leaves dapur's read scope, can still be written). */
export async function advanceOrder(input: { orderId: string }): Promise<AdvanceResult> {
  const { supabase } = await requireDapur()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Data tidak valid.' }

  const { error } = await supabase.rpc('advance_order', { p_order_id: parsed.data.orderId })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
