import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'

const nav = [
  { href: '/owner/dashboard', label: 'Dashboard' },
  { href: '/owner/produk', label: 'Produk' },
  { href: '/owner/stok', label: 'Stok' },
  { href: '/owner/laporan', label: 'Laporan' },
  { href: '/owner/akun', label: 'Akun' },
]

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-56 shrink-0 flex-col border-r border-black/10 bg-white p-4">
        <div className="px-2 font-mono text-lg font-semibold text-ink">Lumi POS</div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-btn px-2 py-2 text-sm text-ink hover:bg-black/5"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button className="min-h-11 w-full rounded-btn border border-ink-muted/40 px-3 text-sm text-ink hover:bg-black/5">
            Keluar
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
