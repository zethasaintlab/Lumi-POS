import { createClient } from '@/lib/supabase/server'
import { AccountForm } from '@/components/owner/account-form'
import { setAccountActive } from './actions'

export default async function AkunPage() {
  const supabase = await createClient()
  const { data: accounts } = await supabase
    .from('users')
    .select('id, name, role, is_active, created_at')
    .in('role', ['kasir', 'dapur'])
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-semibold text-ink">Kelola Akun</h1>
        <p className="mt-1 text-sm text-ink-muted">Buat & nonaktifkan akun kasir dan dapur.</p>
      </div>

      <AccountForm />

      <div className="overflow-hidden rounded-card border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/10 text-xs text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(accounts ?? []).map((acc) => (
              <tr key={acc.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 text-ink">{acc.name}</td>
                <td className="px-4 py-3 capitalize text-ink-muted">{acc.role}</td>
                <td className="px-4 py-3">
                  <span className={acc.is_active ? 'text-stamp-green' : 'text-stamp-red'}>
                    {acc.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={setAccountActive.bind(null, acc.id, !acc.is_active)}>
                    <button className="min-h-9 rounded-btn border border-ink-muted/40 px-3 text-xs text-ink hover:bg-black/5">
                      {acc.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(accounts ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  Belum ada akun kasir/dapur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
