import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Route prefixes that require an authenticated session. A copied/shared URL to
 * any of these will bounce an un-authenticated (or different) visitor to the
 * login page with a `next` param, so after they sign into THEIR OWN account
 * they land on the same page — scoped to their account, never the sharer's.
 */
const PROTECTED_PREFIXES = [
  '/profile',
  '/dashboard',
  '/wallet',
  '/trips',
  '/trip',
  '/create',
  '/features/expense-splitting',
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export async function updateSession(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth'
    loginUrl.search = ''
    loginUrl.searchParams.set('mode', 'signin')
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return response
}
