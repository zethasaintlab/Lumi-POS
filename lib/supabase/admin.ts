import 'server-only'
import { createClient } from '@supabase/supabase-js'

/** Service-role client. Bypasses RLS — server-only.
 *  Aturan Keras #4: SUPABASE_SERVICE_ROLE_KEY must never be NEXT_PUBLIC_ and
 *  never reach a Client Component. The 'server-only' import enforces that at
 *  build time (importing this from client code fails the build). */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
