import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

// Bootstrap the first Owner account. There is no public signup and RLS blocks
// self-creation, so the first owner must be seeded with the service role.
// Usage: npx tsx scripts/seed-owner.ts <email> <password> [name]
async function main() {
  const [email, password, name = 'Owner'] = process.argv.slice(2)
  if (!email || !password) {
    console.error('Usage: npx tsx scripts/seed-owner.ts <email> <password> [name]')
    process.exit(1)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    console.error('Failed to create auth user:', error?.message)
    process.exit(1)
  }

  const { error: profileError } = await admin.from('users').insert({
    id: data.user.id,
    name,
    role: 'owner',
    is_active: true,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    console.error('Failed to create profile:', profileError.message)
    process.exit(1)
  }

  console.log(`Owner created: ${email}`)
}

main()
