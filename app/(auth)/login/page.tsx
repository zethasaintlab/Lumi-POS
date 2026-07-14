'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'

const initialState: LoginState = {}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <main className="w-full max-w-sm">
      <div className="rounded-card border border-black/5 bg-white p-8 shadow-sm">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-ink">Lumi POS</h1>
        <p className="mt-1 text-sm text-ink-muted">Masuk untuk melanjutkan.</p>

        <form action={formAction} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="min-h-11 w-full rounded-input border border-ink-muted/40 bg-white px-3 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="min-h-11 w-full rounded-input border border-ink-muted/40 bg-white px-3 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </div>

          {state.error && (
            <p role="alert" aria-live="polite" className="text-sm text-stamp-red">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full rounded-btn bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  )
}
