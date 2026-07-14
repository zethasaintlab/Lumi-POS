import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { homeForRole, type UserRole } from '@/lib/roles'

/** Per-request auth + role routing (technical-architecture §2).
 *  Next 16 proxy convention (formerly middleware); runs on the Node.js runtime.
 *  v1 reads role from the `users` table (not a JWT claim) — one extra query
 *  per request, accepted for simplicity. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isLogin = path === '/login'

  // Unauthenticated
  if (!user) {
    return isLogin ? response : redirectTo('/login', request, response)
  }

  // Authenticated: resolve role + active status from profile
  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  // Deactivated (FR-12) or missing profile → sign out, bounce to login.
  // This is what makes account deactivation actually block login.
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return redirectTo('/login', request, response)
  }

  const role = profile.role as UserRole
  const home = homeForRole(role)

  if (path === '/' || isLogin) {
    return redirectTo(home, request, response)
  }

  // Route-group access control. Owner may enter kasir/dapur too (can step in).
  if (path.startsWith('/owner') && role !== 'owner') {
    return redirectTo('/login', request, response)
  }
  if (path.startsWith('/kasir') && !(role === 'kasir' || role === 'owner')) {
    return redirectTo('/login', request, response)
  }
  if (path.startsWith('/dapur') && !(role === 'dapur' || role === 'owner')) {
    return redirectTo('/login', request, response)
  }

  return response
}

/** Redirect while carrying over any refreshed auth cookies set on `response`. */
function redirectTo(pathname: string, request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const res = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie.name, cookie.value))
  return res
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
