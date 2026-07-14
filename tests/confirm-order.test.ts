import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// M3 DoD: confirm_order must be atomic and race-safe. Runs against the LINKED
// REMOTE project; seeds throwaway users/products/ingredients and cleans up.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const PASSWORD = 'ConfirmTest1234!'
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`

const users = {
  owner: { email: `co-owner-${suffix}@example.com`, id: '' },
  kasir: { email: `co-kasir-${suffix}@example.com`, id: '' },
  dapur: { email: `co-dapur-${suffix}@example.com`, id: '' },
}

// track for cleanup
const orderIds: string[] = []
const productIds: string[] = []
const ingredientIds: string[] = []

async function makeUser(email: string, role: 'owner' | 'kasir' | 'dapur') {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('no user')
  const { error: pErr } = await admin.from('users').insert({ id: data.user.id, name: `CO ${role}`, role, is_active: true })
  if (pErr) throw pErr
  return data.user.id
}

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return c
}

async function makeIngredient(name: string, stock: number) {
  const { data, error } = await admin
    .from('ingredients')
    .insert({ name: `${name}-${suffix}`, unit: 'gram', current_stock: stock, min_stock_threshold: 0 })
    .select('id')
    .single()
  if (error) throw error
  ingredientIds.push(data.id)
  return data.id as string
}

async function makeProduct(name: string, price: number, active = true) {
  const { data, error } = await admin
    .from('products')
    .insert({ name: `${name}-${suffix}`, price, is_active: active })
    .select('id')
    .single()
  if (error) throw error
  productIds.push(data.id)
  return data.id as string
}

async function makeRecipe(productId: string, ingredientId: string, qty: number) {
  const { error } = await admin.from('recipes').insert({ product_id: productId, ingredient_id: ingredientId, qty_needed: qty })
  if (error) throw error
}

async function makeOrder(cashierId: string, items: { product_id: string; qty: number; price: number }[]) {
  const { data, error } = await admin
    .from('orders')
    .insert({ status: 'draft', cashier_id: cashierId, payment_method: 'cash' })
    .select('id')
    .single()
  if (error) throw error
  orderIds.push(data.id)
  const { error: iErr } = await admin
    .from('order_items')
    .insert(items.map((i) => ({ order_id: data.id, product_id: i.product_id, qty: i.qty, price_at_order_time: i.price })))
  if (iErr) throw iErr
  return data.id as string
}

async function stockOf(ingredientId: string): Promise<number> {
  const { data } = await admin.from('ingredients').select('current_stock').eq('id', ingredientId).single()
  return Number(data!.current_stock)
}

async function orderRow(orderId: string) {
  const { data } = await admin.from('orders').select('*').eq('id', orderId).single()
  return data!
}

beforeAll(async () => {
  users.owner.id = await makeUser(users.owner.email, 'owner')
  users.kasir.id = await makeUser(users.kasir.email, 'kasir')
  users.dapur.id = await makeUser(users.dapur.email, 'dapur')
})

afterAll(async () => {
  await admin.from('stock_movements').delete().in('order_id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000'])
  if (ingredientIds.length) await admin.from('stock_movements').delete().in('ingredient_id', ingredientIds)
  if (orderIds.length) await admin.from('order_items').delete().in('order_id', orderIds)
  if (orderIds.length) await admin.from('orders').delete().in('id', orderIds)
  if (productIds.length) await admin.from('recipes').delete().in('product_id', productIds)
  if (productIds.length) await admin.from('products').delete().in('id', productIds)
  if (ingredientIds.length) await admin.from('ingredients').delete().in('id', ingredientIds)
  for (const u of Object.values(users)) if (u.id) await admin.auth.admin.deleteUser(u.id)
})

describe('confirm_order (M3)', () => {
  it('deducts stock, logs a negative order movement, and confirms with total/change', async () => {
    const ing = await makeIngredient('Beans', 100)
    const prod = await makeProduct('Latte', 15000)
    await makeRecipe(prod, ing, 10)
    const order = await makeOrder(users.kasir.id, [{ product_id: prod, qty: 2, price: 15000 }]) // needs 20, total 30000

    const kasir = await signIn(users.kasir.email)
    const { error } = await kasir.rpc('confirm_order', { p_order_id: order, p_amount_paid: 50000 })
    expect(error).toBeNull()

    expect(await stockOf(ing)).toBe(80)
    const row = await orderRow(order)
    expect(row.status).toBe('confirmed')
    expect(Number(row.total)).toBe(30000)
    expect(Number(row.amount_paid)).toBe(50000)
    expect(Number(row.change_amount)).toBe(20000)
    expect(row.confirmed_at).not.toBeNull()

    const { data: mv } = await admin.from('stock_movements').select('qty_changed, source').eq('order_id', order)
    expect((mv ?? []).length).toBe(1)
    expect(mv![0].source).toBe('order')
    expect(Number(mv![0].qty_changed)).toBe(-20)
  })

  it('confirms a product without a recipe without deducting anything', async () => {
    const prod = await makeProduct('NoRecipe', 8000)
    const order = await makeOrder(users.kasir.id, [{ product_id: prod, qty: 1, price: 8000 }])
    const kasir = await signIn(users.kasir.email)
    const { error } = await kasir.rpc('confirm_order', { p_order_id: order, p_amount_paid: 10000 })
    expect(error).toBeNull()
    const { data: mv } = await admin.from('stock_movements').select('id').eq('order_id', order)
    expect((mv ?? []).length).toBe(0)
    expect((await orderRow(order)).status).toBe('confirmed')
  })

  it('rejects amount_paid < total and leaves the order draft', async () => {
    const prod = await makeProduct('Pricey', 20000)
    const order = await makeOrder(users.kasir.id, [{ product_id: prod, qty: 1, price: 20000 }])
    const kasir = await signIn(users.kasir.email)
    const { error } = await kasir.rpc('confirm_order', { p_order_id: order, p_amount_paid: 19999 })
    expect(error).not.toBeNull()
    expect((await orderRow(order)).status).toBe('draft')
  })

  it('rejects re-confirming a non-draft order', async () => {
    const prod = await makeProduct('Once', 5000)
    const order = await makeOrder(users.kasir.id, [{ product_id: prod, qty: 1, price: 5000 }])
    const kasir = await signIn(users.kasir.email)
    expect((await kasir.rpc('confirm_order', { p_order_id: order, p_amount_paid: 5000 })).error).toBeNull()
    const second = await kasir.rpc('confirm_order', { p_order_id: order, p_amount_paid: 5000 })
    expect(second.error).not.toBeNull()
  })

  it('succeeds when stock is exactly enough (boundary, inclusive)', async () => {
    const ing = await makeIngredient('Exact', 5)
    const prod = await makeProduct('ExactProd', 3000)
    await makeRecipe(prod, ing, 5)
    const order = await makeOrder(users.kasir.id, [{ product_id: prod, qty: 1, price: 3000 }]) // needs exactly 5
    const kasir = await signIn(users.kasir.email)
    const { error } = await kasir.rpc('confirm_order', { p_order_id: order, p_amount_paid: 3000 })
    expect(error).toBeNull()
    expect(await stockOf(ing)).toBe(0)
  })

  it('rejects a dapur user calling confirm_order', async () => {
    const prod = await makeProduct('DapurBlocked', 4000)
    const order = await makeOrder(users.kasir.id, [{ product_id: prod, qty: 1, price: 4000 }])
    const dapur = await signIn(users.dapur.email)
    const { error } = await dapur.rpc('confirm_order', { p_order_id: order, p_amount_paid: 4000 })
    expect(error).not.toBeNull()
    expect((await orderRow(order)).status).toBe('draft')
  })

  it('two concurrent confirms at tight stock: exactly one succeeds, stock never goes negative (DoD)', async () => {
    const ing = await makeIngredient('Scarce', 10)
    const prod = await makeProduct('ScarceProd', 12000)
    await makeRecipe(prod, ing, 10) // each order consumes the entire stock
    const orderA = await makeOrder(users.kasir.id, [{ product_id: prod, qty: 1, price: 12000 }])
    const orderB = await makeOrder(users.kasir.id, [{ product_id: prod, qty: 1, price: 12000 }])

    const c1 = await signIn(users.kasir.email)
    const c2 = await signIn(users.kasir.email)
    const [a, b] = await Promise.all([
      c1.rpc('confirm_order', { p_order_id: orderA, p_amount_paid: 12000 }),
      c2.rpc('confirm_order', { p_order_id: orderB, p_amount_paid: 12000 }),
    ])

    const errors = [a.error, b.error].filter(Boolean)
    expect(errors.length).toBe(1)
    expect(errors[0]!.message).toMatch(/Stok tidak cukup/)
    const finalStock = await stockOf(ing)
    expect(finalStock).toBe(0)
    expect(finalStock).toBeGreaterThanOrEqual(0)
  })
})

describe('checkout_order (M3)', () => {
  it('builds an order from cart items and confirms atomically', async () => {
    const ing = await makeIngredient('CheckoutBeans', 100)
    const prod = await makeProduct('CheckoutLatte', 15000)
    await makeRecipe(prod, ing, 5)

    const kasir = await signIn(users.kasir.email)
    const { data, error } = await kasir.rpc('checkout_order', {
      p_items: [{ product_id: prod, qty: 2 }],
      p_amount_paid: 40000,
    })
    expect(error).toBeNull()
    // returns the confirmed order row
    const confirmed = Array.isArray(data) ? data[0] : data
    orderIds.push(confirmed.id)
    expect(confirmed.status).toBe('confirmed')
    expect(Number(confirmed.total)).toBe(30000)
    expect(Number(confirmed.change_amount)).toBe(10000)
    expect(confirmed.order_number).toMatch(/^\d{6}-\d{3,}$/)
    expect(await stockOf(ing)).toBe(90)
  })

  it('rejects checkout with an inactive product', async () => {
    const prod = await makeProduct('Inactive', 9000, false)
    const kasir = await signIn(users.kasir.email)
    const { error } = await kasir.rpc('checkout_order', { p_items: [{ product_id: prod, qty: 1 }], p_amount_paid: 9000 })
    expect(error).not.toBeNull()
  })
})
