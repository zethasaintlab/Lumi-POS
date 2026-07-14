import { createClient } from '@/lib/supabase/server'
import { IngredientForm } from '@/components/owner/ingredient-form'
import { IngredientActions, type Ingredient } from '@/components/owner/ingredient-actions'
import { StampBadge } from '@/components/owner/badge'
import { cardClass } from '@/components/owner/ui'

export default async function StokPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ingredients')
    .select('id, name, unit, current_stock, min_stock_threshold')
    .order('name', { ascending: true })

  // Coerce numerics to Number — PostgREST may return NUMERIC as a string, which
  // would break the <= comparison below.
  const ingredients: Ingredient[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    current_stock: Number(r.current_stock),
    min_stock_threshold: Number(r.min_stock_threshold),
  }))

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-semibold text-ink">Kelola Stok Bahan Baku</h1>
        <p className="mt-1 text-sm text-ink-muted">Bahan baku, stok, dan restock manual.</p>
      </div>

      <IngredientForm />

      <div className={`overflow-hidden ${cardClass}`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/10 text-xs text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Stok</th>
              <th className="px-4 py-3 font-medium">Ambang</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => {
              const low = ing.current_stock <= ing.min_stock_threshold
              return (
                <tr key={ing.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3 text-ink">{ing.name}</td>
                  <td className="px-4 py-3 font-mono text-ink">
                    {ing.current_stock} <span className="text-ink-muted">{ing.unit}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink-muted">{ing.min_stock_threshold}</td>
                  <td className="px-4 py-3">{low && <StampBadge tone="amber">stok menipis</StampBadge>}</td>
                  <td className="px-4 py-3">
                    <IngredientActions ingredient={ing} />
                  </td>
                </tr>
              )
            })}
            {ingredients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  Belum ada bahan baku.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
