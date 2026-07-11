import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/** Singleton browser client — uses cookie storage via @supabase/auth-helpers-nextjs. */
export const supabase = createSupabaseBrowserClient()
