import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/roles'

async function currentUserRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, role: null as UserRole | null }
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return { supabase, user, role: (data?.role ?? null) as UserRole | null }
}

/** Ensures the caller is an authenticated owner. Server actions are callable
 *  endpoints, so every owner-only action must re-check server-side (defense in
 *  depth on top of the proxy route guard). Returns the server client + user id. */
export async function requireOwner() {
  const { supabase, user, role } = await currentUserRole()
  if (!user) throw new Error('Tidak terautentikasi.')
  if (role !== 'owner') throw new Error('Akses ditolak.')
  return { supabase, userId: user.id }
}

/** Ensures the caller is kasir or owner (staff who can run the kasir flow). */
export async function requireStaff() {
  const { supabase, user, role } = await currentUserRole()
  if (!user) throw new Error('Tidak terautentikasi.')
  if (role !== 'kasir' && role !== 'owner') throw new Error('Akses ditolak.')
  return { supabase, userId: user.id }
}
