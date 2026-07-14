'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/auth/guards'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  email: z.string().email('Email tidak valid.'),
  password: z.string().min(8, 'Password minimal 8 karakter.'),
  role: z.enum(['kasir', 'dapur']),
})

export type CreateAccountState = { error?: string; ok?: boolean }

export async function createAccount(
  _prev: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  await requireOwner()

  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }
  }
  const { name, email, password, role } = parsed.data

  const admin = createAdminClient()
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !created.user) {
    return { error: error?.message ?? 'Gagal membuat akun auth.' }
  }

  const { error: profileError } = await admin.from('users').insert({
    id: created.user.id,
    name,
    role,
    is_active: true,
  })
  if (profileError) {
    // Roll back the orphaned auth user so the two stores stay consistent.
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/owner/akun')
  return { ok: true }
}

export async function setAccountActive(userId: string, isActive: boolean) {
  await requireOwner()
  const admin = createAdminClient()
  await admin.from('users').update({ is_active: isActive }).eq('id', userId)
  revalidatePath('/owner/akun')
}
