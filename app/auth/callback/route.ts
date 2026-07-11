import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const oauthError = requestUrl.searchParams.get('error')
  const oauthErrorDescription = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next')
  const origin = requestUrl.origin

  if (oauthError) {
    const message = oauthErrorDescription || oauthError
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent(message)}`,
    )
  }

  const completeUrl = new URL(`${origin}/auth/complete`)
  if (next) completeUrl.searchParams.set('next', next)
  let response = NextResponse.redirect(completeUrl)

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent('Sign-in was cancelled or failed. Please try again.')}`,
    )
  }

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
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent(error.message)}`,
    )
  }

  return response
}
