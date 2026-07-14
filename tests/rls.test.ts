import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// M1 Definition of Done: prove RLS directly via the Supabase client — kasir/dapur
// must have ZERO access to ingredients / recipes / stock_movements.
// This test seeds its own users + a locked ingredient/recipe/movement against the
// LINKED REMOTE project, then cleans everything up.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const PASSWORD = 'RlsTest1234!'
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const accounts = {
  owner: { email: `rlstest-owner-${suffix}@example.com`, id: '' },
  kasir: { email: `rlstest-kasir-${suffix}@example.com`, id: '' },
  dapur: { email: `rlstest-dapur-${suffix}@example.com`, id: '' },
}
let productId = ''
let ingredientId = ''

async function makeUser(email: string, role: 'owner' | 'kasir' | 'dapur') {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('no user')
  const { error: pErr } = await admin.from('users').insert({ id: data.user.id, name: `RLS ${role}`, role, is_active: true })
  if (pErr) throw pErr
  return data.user.id
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

beforeAll(async () => {
  accounts.owner.id = await makeUser(accounts.owner.email, 'owner')
  accounts.kasir.id = await makeUser(accounts.kasir.email, 'kasir')
  accounts.dapur.id = await makeUser(accounts.dapur.email, 'dapur')

  const { data: prod, error: prodErr } = await admin
    .from('products')
    .insert({ name: `RLS Coffee ${suffix}`, price: 10000 })
    .select('id')
    .single()
  if (prodErr) throw prodErr
  productId = prod.id

  const { data: ing, error: ingErr } = await admin
    .from('ingredients')
    .insert({ name: `RLS Beans ${suffix}`, unit: 'gram', current_stock: 100, min_stock_threshold: 20 })
    .select('id')
    .single()
  if (ingErr) throw ingErr
  ingredientId = ing.id

  await admin.from('recipes').insert({ product_id: productId, ingredient_id: ingredientId, qty_needed: 5 })
  await admin.from('stock_movements').insert({
    ingredient_id: ingredientId,
    qty_changed: 100,
    source: 'manual_restock',
    created_by: accounts.owner.id,
  })
})

afterAll(async () => {
  // Order matters: RESTRICT/NO-ACTION FKs require children removed first.
  await admin.from('recipes').delete().eq('ingredient_id', ingredientId)
  await admin.from('stock_movements').delete().eq('ingredient_id', ingredientId)
  await admin.from('ingredients').delete().eq('id', ingredientId)
  await admin.from('products').delete().eq('id', productId)
  for (const a of Object.values(accounts)) {
    if (a.id) await admin.auth.admin.deleteUser(a.id) // cascades public.users
  }
})

describe('RLS access matrix (M1 DoD)', () => {
  for (const role of ['kasir', 'dapur'] as const) {
    it(`${role} is denied ingredients / recipes / stock_movements`, async () => {
      const c = await signIn(accounts[role].email)
      expect((await c.from('ingredients').select('*')).data ?? []).toHaveLength(0)
      expect((await c.from('recipes').select('*')).data ?? []).toHaveLength(0)
      expect((await c.from('stock_movements').select('*')).data ?? []).toHaveLength(0)
    })

    it(`${role} cannot INSERT into ingredients`, async () => {
      const c = await signIn(accounts[role].email)
      const res = await c.from('ingredients').insert({ name: 'x', unit: 'g', min_stock_threshold: 1 })
      expect(res.error).not.toBeNull()
    })
  }

  it('kasir sees only its own profile and active products', async () => {
    const c = await signIn(accounts.kasir.email)
    const me = await c.from('users').select('id')
    expect(me.data).toHaveLength(1)
    expect(me.data?.[0].id).toBe(accounts.kasir.id)

    const prods = await c.from('products').select('id')
    expect((prods.data ?? []).some((p) => p.id === productId)).toBe(true)
  })

  it('owner can read ingredients / recipes / stock_movements', async () => {
    const c = await signIn(accounts.owner.email)
    expect(((await c.from('ingredients').select('id')).data ?? []).length).toBeGreaterThan(0)
    expect(((await c.from('recipes').select('id')).data ?? []).length).toBeGreaterThan(0)
    expect(((await c.from('stock_movements').select('id')).data ?? []).length).toBeGreaterThan(0)
  })
})
