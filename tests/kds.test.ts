import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// M4: verify the KDS status-write path — dapur advances confirmed→completed under
// RLS, completed_at is stamped by the trigger, dapur can't go backward, and kasir
// can't touch a confirmed order. (Realtime delivery itself is a manual DoD test.)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const PASSWORD = 'KdsTest1234!'
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const users = {
  kasir: { email: `kds-kasir-${suffix}@example.com`, id: '' },
  dapur: { email: `kds-dapur-${suffix}@example.com`, id: '' },
}
const orderIds: string[] = []
let productId = ''

async function makeUser(email: string, role: 'kasir' | 'dapur') {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('no user')
  const { error: pErr } = await admin.from('users').insert({ id: data.user.id, name: `KDS ${role}`, role, is_active: true })
  if (pErr) throw pErr
  return data.user.id
}

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return c
}

async function makeConfirmedOrder() {
  const { data, error } = await admin
    .from('orders')
    .insert({
      status: 'confirmed',
      cashier_id: users.kasir.id,
      payment_method: 'cash',
      total: 10000,
      amount_paid: 10000,
      change_amount: 0,
      confirmed_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  orderIds.push(data.id)
  await admin.from('order_items').insert({ order_id: data.id, product_id: productId, qty: 1, price_at_order_time: 10000 })
  return data.id as string
}

async function statusOf(orderId: string) {
  const { data } = await admin.from('orders').select('status, completed_at').eq('id', orderId).single()
  return data!
}

beforeAll(async () => {
  users.kasir.id = await makeUser(users.kasir.email, 'kasir')
  users.dapur.id = await makeUser(users.dapur.email, 'dapur')
  const { data, error } = await admin.from('products').insert({ name: `KDS Prod ${suffix}`, price: 10000 }).select('id').single()
  if (error) throw error
  productId = data.id
})

afterAll(async () => {
  if (orderIds.length) await admin.from('order_items').delete().in('order_id', orderIds)
  if (orderIds.length) await admin.from('orders').delete().in('id', orderIds)
  if (productId) await admin.from('products').delete().eq('id', productId)
  for (const u of Object.values(users)) if (u.id) await admin.auth.admin.deleteUser(u.id)
})

describe('KDS status transitions (M4)', () => {
  it('dapur advances confirmed → in_kitchen → ready → completed via advance_order, completed_at stamped', async () => {
    const order = await makeConfirmedOrder()
    const dapur = await signIn(users.dapur.email)

    expect((await dapur.rpc('advance_order', { p_order_id: order })).error).toBeNull()
    expect((await statusOf(order)).status).toBe('in_kitchen')

    expect((await dapur.rpc('advance_order', { p_order_id: order })).error).toBeNull()
    expect((await statusOf(order)).status).toBe('ready')

    expect((await dapur.rpc('advance_order', { p_order_id: order })).error).toBeNull()
    const done = await statusOf(order)
    expect(done.status).toBe('completed')
    expect(done.completed_at).not.toBeNull()
  })

  it('advancing an already-completed order is rejected', async () => {
    const order = await makeConfirmedOrder()
    const dapur = await signIn(users.dapur.email)
    await dapur.rpc('advance_order', { p_order_id: order }) // in_kitchen
    await dapur.rpc('advance_order', { p_order_id: order }) // ready
    await dapur.rpc('advance_order', { p_order_id: order }) // completed
    const res = await dapur.rpc('advance_order', { p_order_id: order })
    expect(res.error).not.toBeNull()
  })

  it('kasir cannot advance an order (role guard)', async () => {
    const order = await makeConfirmedOrder()
    const kasir = await signIn(users.kasir.email)
    const res = await kasir.rpc('advance_order', { p_order_id: order })
    expect(res.error).not.toBeNull()
    expect((await statusOf(order)).status).toBe('confirmed') // unchanged
  })
})
