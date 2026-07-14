import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StampBadge } from '@/components/owner/badge'
import { cardClass, primaryBtn, rowBtn } from '@/components/owner/ui'
import { formatRupiah } from '@/lib/format'
import { setProductActive } from './actions'

export default async function ProdukPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, price, category, is_active, recipes(count)')
    .order('name', { ascending: true })

  const products = (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    price: Number(p.price),
    category: (p.category as string | null) ?? null,
    is_active: p.is_active as boolean,
    recipeCount: Array.isArray(p.recipes) ? (p.recipes[0]?.count ?? 0) : 0,
  }))

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold text-ink">Kelola Produk &amp; Resep</h1>
          <p className="mt-1 text-sm text-ink-muted">Produk, harga, dan resep bahan baku.</p>
        </div>
        <Link href="/owner/produk/new" className={primaryBtn}>+ Produk</Link>
      </div>

      <div className={`overflow-hidden ${cardClass}`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/10 text-xs text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Harga</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 text-ink">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{p.name}</span>
                    {p.recipeCount === 0 && <StampBadge tone="muted">stok tidak terlacak</StampBadge>}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-ink">{formatRupiah(p.price)}</td>
                <td className="px-4 py-3 text-ink-muted">{p.category ?? '—'}</td>
                <td className="px-4 py-3">
                  <StampBadge tone={p.is_active ? 'green' : 'red'}>{p.is_active ? 'Aktif' : 'Nonaktif'}</StampBadge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link href={`/owner/produk/${p.id}/edit`} className={rowBtn}>Edit</Link>
                    <form action={setProductActive.bind(null, p.id, !p.is_active)}>
                      <button className={rowBtn}>{p.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">Belum ada produk.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
