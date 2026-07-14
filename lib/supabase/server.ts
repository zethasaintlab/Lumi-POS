import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Server client — Server Components / Route Handlers / Server Actions.
 *  Reads the session from cookies (@supabase/ssr), never localStorage. */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component (read-only cookies); the
            // middleware refreshes the session cookie instead. Safe to ignore.
          }
        },
      },
    },
  )
}
