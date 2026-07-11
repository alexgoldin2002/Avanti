/** Redirect URL registered in Supabase → Authentication → URL configuration. */
export function authCallbackUrl(next?: string | null): string {
  const safe = safeNextPath(next)
  const suffix = safe ? `?next=${encodeURIComponent(safe)}` : ''
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback${suffix}`
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return site ? `${site}/auth/callback${suffix}` : ''
}

/**
 * Validate a post-login `next` destination so a copied/shared link can only ever
 * send someone to an in-app page — never to another origin, and never back into
 * the auth flow. Returns a safe relative path or null.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null
  let value = next.trim()
  if (!value) return null
  // Must be a same-origin relative path (reject protocol-relative and absolute URLs).
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  // Reject anything that resolves to an external URL after decoding.
  try {
    value = decodeURIComponent(value)
  } catch {
    return null
  }
  if (!value.startsWith('/') || value.startsWith('//')) return null
  // Don't loop back through auth pages.
  if (value === '/auth' || value.startsWith('/auth/') || value.startsWith('/auth?')) return null
  return value
}
