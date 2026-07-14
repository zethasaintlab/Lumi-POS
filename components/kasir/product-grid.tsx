'use client'

import { formatRupiah } from '@/lib/format'

export type KasirProduct = { id: string; name: string; price: number; category: string | null }

function groupByCategory(products: KasirProduct[]): [string, KasirProduct[]][] {
  const map = new Map<string, KasirProduct[]>()
  for (const p of products) {
    const cat = p.category ?? 'Lainnya'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(p)
  }
  return [...map.entries()]
}

export function ProductGrid({ products, onAdd }: { products: KasirProduct[]; onAdd: (p: KasirProduct) => void }) {
  if (products.length === 0) {
    return (
      <div className="rounded-card border border-black/5 bg-white p-8 text-center text-ink-muted">
        Belum ada produk aktif. Owner perlu menambah produk dulu.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groupByCategory(products).map(([cat, items]) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-muted">{cat}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAdd(p)}
                className="flex min-h-24 flex-col justify-between rounded-card border border-black/10 bg-paper p-3 text-left transition-transform hover:border-ink/30 active:scale-95"
              >
                <span className="text-sm font-medium text-ink">{p.name}</span>
                <span className="font-mono text-sm text-ink">{formatRupiah(p.price)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
