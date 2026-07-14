import { describe, it, expect } from 'vitest'
import { cartTotal, computeChange, isSufficient } from '../lib/cart'

describe('cart calc (M3 total & change)', () => {
  const items = [
    { price: 10000, qty: 2 }, // 20000
    { price: 5500, qty: 3 }, // 16500
  ]

  it('sums line totals', () => {
    expect(cartTotal(items)).toBe(36500)
  })

  it('empty cart totals 0', () => {
    expect(cartTotal([])).toBe(0)
  })

  it('change = paid - total', () => {
    expect(computeChange(36500, 50000)).toBe(13500)
  })

  it('exact payment → 0 change and is sufficient (boundary)', () => {
    expect(computeChange(36500, 36500)).toBe(0)
    expect(isSufficient(36500, 36500)).toBe(true)
  })

  it('underpayment is insufficient', () => {
    expect(isSufficient(36500, 36499)).toBe(false)
  })
})
