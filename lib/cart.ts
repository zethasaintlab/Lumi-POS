export type CartItem = { productId: string; name: string; price: number; qty: number }

/** Sum of price * qty across cart lines. */
export function cartTotal(items: { price: number; qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0)
}

/** Change owed = paid - total. Caller should only confirm when paid >= total. */
export function computeChange(total: number, paid: number): number {
  return paid - total
}

/** FR-2: payment must be at least the total (inclusive). */
export function isSufficient(total: number, paid: number): boolean {
  return paid >= total
}
