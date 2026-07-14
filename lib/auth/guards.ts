import { createClient } from '@/lib/supabase/server'

/** Ensures the caller is an authenticated owner. Server actions are callable
 *  endpoints, so every owner-only action must re-check server-side (defense in
 *  depth on top of the proxy route guard). Returns the server client + user id. */
export async function requireOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi.')
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'owner') throw new Error('Akses ditolak.')
  return { supabase, userId: user.id }
}
