import { signOut } from '@/lib/actions/auth'

export default function DapurPage() {
  return (
    <main className="min-h-dvh p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-semibold text-ink">KDS Board</h1>
        <form action={signOut}>
          <button className="min-h-11 rounded-btn border border-ink-muted/40 px-3 text-sm text-ink hover:bg-black/5">
            Keluar
          </button>
        </form>
      </header>
      <p className="mt-6 text-sm text-ink-muted">Kitchen Display System dibangun di M4.</p>
    </main>
  )
}
