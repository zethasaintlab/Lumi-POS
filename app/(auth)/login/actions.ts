'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { homeForRole, type UserRole } from '@/lib/roles'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginState = { error?: string }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Email atau password tidak valid.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error || !data.user) return { error: 'Email atau password salah.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return { error: 'Akun tidak aktif. Hubungi Owner.' }
  }

  redirect(homeForRole(profile.role as UserRole))
}
