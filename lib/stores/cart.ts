import { create } from 'zustand'
import type { CartItem } from '@/lib/cart'

// Ephemeral client-side cart (technical-architecture §3): the order draft lives
// here until payment, when it's written to Supabase. Void = clear().
type CartState = {
  items: CartItem[]
  add: (p: { productId: string; name: string; price: number }) => void
  inc: (productId: string) => void
  dec: (productId: string) => void // removes the line when qty hits 0
  clear: () => void
}

export const useCart = create<CartState>((set) => ({
  items: [],
  add: (p) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === p.productId)
      if (existing) {
        return { items: s.items.map((i) => (i.productId === p.productId ? { ...i, qty: i.qty + 1 } : i)) }
      }
      return { items: [...s.items, { ...p, qty: 1 }] }
    }),
  inc: (id) => set((s) => ({ items: s.items.map((i) => (i.productId === id ? { ...i, qty: i.qty + 1 } : i)) })),
  dec: (id) =>
    set((s) => ({
      items: s.items.flatMap((i) => (i.productId !== id ? [i] : i.qty <= 1 ? [] : [{ ...i, qty: i.qty - 1 }])),
    })),
  clear: () => set({ items: [] }),
}))
