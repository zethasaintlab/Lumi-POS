'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createAccount, type CreateAccountState } from '@/app/(owner)/owner/akun/actions'

const initialState: CreateAccountState = {}

const inputClass =
  'min-h-11 w-full rounded-input border border-ink-muted/40 bg-white px-3 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10'

export function AccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-card border border-black/5 bg-white p-6">
      <h2 className="font-mono text-lg font-semibold text-ink">Buat Akun</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-xs font-medium text-ink">Nama</label>
          <input id="name" name="name" required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="role" className="block text-xs font-medium text-ink">Role</label>
          <select id="role" name="role" required defaultValue="kasir" className={inputClass}>
            <option value="kasir">Kasir</option>
            <option value="dapur">Dapur</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-medium text-ink">Email</label>
          <input id="email" name="email" type="email" autoComplete="off" required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-medium text-ink">Password awal</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        </div>
      </div>

      {state.error && (
        <p role="alert" aria-live="polite" className="text-sm text-stamp-red">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" aria-live="polite" className="text-sm text-stamp-green">Akun berhasil dibuat.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-btn bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Menyimpan…' : 'Simpan Akun'}
      </button>
    </form>
  )
}
