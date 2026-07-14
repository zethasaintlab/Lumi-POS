import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// M2: the atomic stock functions are the high-risk path (Aturan Keras #1).
// Verify restock/adjust update current_stock AND log the right movement, that a
// non-owner is rejected, and that stock can't go negative. Runs against the
// LINKED REMOTE project and cleans up.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const PASSWORD = 'StockTest1234!'
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const accounts = {
  owner: { email: `stocktest-owner-${suffix}@example.com`, id: '' },
  kasir: { email: `stocktest-kasir-${suffix}@example.com`, id: '' },
}
let ingredientId = ''

async function makeUser(email: string, role: 'owner' | 'kasir') {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('no user')
  const { error: pErr } = await admin.from('users').insert({ id: data.user.id, name: `Stock ${role}`, role, is_active: true })
  if (pErr) throw pErr
  return data.user.id
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

async function stockOf(): Promise<number> {
  const { data } = await admin.from('ingredients').select('current_stock').eq('id', ingredientId).single()
  return Number(data!.current_stock)
}

beforeAll(async () => {
  accounts.owner.id = await makeUser(accounts.owner.email, 'owner')
  accounts.kasir.id = await makeUser(accounts.kasir.email, 'kasir')
  const { data, error } = await admin
    .from('ingredients')
    .insert({ name: `Stock Beans ${suffix}`, unit: 'gram', current_stock: 100, min_stock_threshold: 20 })
    .select('id')
    .single()
  if (error) throw error
  ingredientId = data.id
})

afterAll(async () => {
  await admin.from('stock_movements').delete().eq('ingredient_id', ingredientId)
  await admin.from('ingredients').delete().eq('id', ingredientId)
  for (const a of Object.values(accounts)) {
    if (a.id) await admin.auth.admin.deleteUser(a.id)
  }
})

describe('stock functions (M2)', () => {
  it('owner restock adds stock and logs a manual_restock movement', async () => {
    const c = await signIn(accounts.owner.email)
    const { error } = await c.rpc('restock_ingredient', { p_ingredient_id: ingredientId, p_qty: 50 })
    expect(error).toBeNull()
    expect(await stockOf()).toBe(150)

    const { data: mv } = await admin
      .from('stock_movements')
      .select('qty_changed, source, created_by')
      .eq('ingredient_id', ingredientId)
      .eq('source', 'manual_restock')
    expect((mv ?? []).length).toBe(1)
    expect(Number(mv![0].qty_changed)).toBe(50)
    expect(mv![0].created_by).toBe(accounts.owner.id)
  })

  it('owner adjust sets absolute stock and logs the signed delta', async () => {
    const c = await signIn(accounts.owner.email)
    const { error } = await c.rpc('adjust_ingredient_stock', { p_ingredient_id: ingredientId, p_new_stock: 120 })
    expect(error).toBeNull()
    expect(await stockOf()).toBe(120) // 150 -> 120

    const { data: mv } = await admin
      .from('stock_movements')
      .select('qty_changed')
      .eq('ingredient_id', ingredientId)
      .eq('source', 'manual_adjustment')
    expect((mv ?? []).length).toBe(1)
    expect(Number(mv![0].qty_changed)).toBe(-30)
  })

  it('kasir is rejected from restock', async () => {
    const k = await signIn(accounts.kasir.email)
    const { error } = await k.rpc('restock_ingredient', { p_ingredient_id: ingredientId, p_qty: 10 })
    expect(error).not.toBeNull()
    expect(await stockOf()).toBe(120) // unchanged
  })

  it('adjust below zero is rejected', async () => {
    const c = await signIn(accounts.owner.email)
    const { error } = await c.rpc('adjust_ingredient_stock', { p_ingredient_id: ingredientId, p_new_stock: -5 })
    expect(error).not.toBeNull()
    expect(await stockOf()).toBe(120) // unchanged
  })
})
