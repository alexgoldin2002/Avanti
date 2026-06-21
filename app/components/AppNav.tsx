'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const MENU_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Features', href: '/features' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Profile', href: '/profile' },
]

export default function AppNav({ userName }: { userName?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [displayName, setDisplayName] = useState(userName?.toUpperCase() || '')

  useEffect(() => {
    if (userName) {
      setDisplayName(userName.toUpperCase())
      return
    }
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle()
      const first = profile?.full_name?.split(' ')[0]
      if (first) setDisplayName(first.toUpperCase())
    }
    load()
  }, [userName])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-40 bg-forest-deep text-cream">
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-8 min-w-0 flex-1">
          {MENU_LINKS.filter(l => l.href !== '/dashboard' && l.href !== '/profile' && l.href !== '/features').map(item => (
            <Link
              key={item.label}
              href={item.href}
              className="hidden md:inline text-[11px] tracking-[0.3em] uppercase text-cream/85 transition-colors hover:text-cream whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Link
          href="/dashboard"
          className="absolute left-1/2 -translate-x-1/2 font-serif text-lg tracking-[0.5em] text-cream whitespace-nowrap"
        >
          AVANTI
        </Link>

        <div className="flex items-center justify-end gap-4 flex-1">
          {displayName && (
            <span className="text-[11px] tracking-[0.25em] uppercase text-cream/85 truncate max-w-[140px] sm:max-w-none">
              {displayName}
            </span>
          )}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
            className="flex flex-col justify-center gap-[5px] p-1 text-cream/90 transition hover:text-cream shrink-0"
          >
            <span className={`block h-px w-5 bg-current transition-transform origin-center ${menuOpen ? 'translate-y-[6px] rotate-45' : ''}`} />
            <span className={`block h-px w-5 bg-current transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-px w-5 bg-current transition-transform origin-center ${menuOpen ? '-translate-y-[6px] -rotate-45' : ''}`} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 top-[72px] z-30 bg-black/20"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-40 border-t border-cream/10 bg-forest-deep shadow-lg">
            <div className="mx-auto max-w-7xl px-6 py-2 sm:px-10">
              <div className="flex flex-col">
                {MENU_LINKS.map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="py-3 text-[11px] tracking-[0.3em] uppercase text-cream/85 transition-colors hover:text-cream"
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="py-3 text-left text-[11px] tracking-[0.3em] uppercase text-cream/60 transition-colors hover:text-cream border-t border-cream/10 mt-1"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
