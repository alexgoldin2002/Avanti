'use client'
import Link from 'next/link'

export default function Footer({ variant = 'app', paddingTop = 48 }: { variant?: 'marketing' | 'app'; paddingTop?: number }) {
  if (variant === 'marketing') {
    return (
      <footer className="bg-forest-deep text-cream">
        <div className="px-6 md:px-10 py-16 grid gap-12 md:grid-cols-4 border-b border-cream/15 max-w-[1200px] mx-auto">
          <div className="md:col-span-2">
            <div className="font-serif tracking-[0.45em] text-xl">AVANTI</div>
            <p className="mt-6 font-serif italic text-2xl md:text-3xl max-w-md leading-snug text-cream/90">
              You bring the people. Avanti brings the plan.
            </p>
          </div>
          <div>
            <div className="eyebrow text-cream/60 mb-4">Explore</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/how-it-works" className="hover:opacity-70">How it works</Link></li>
              <li><Link href="/about" className="hover:opacity-70">About</Link></li>
              <li><Link href="/contact" className="hover:opacity-70">Contact</Link></li>
              <li><Link href="/dashboard" className="hover:opacity-70">Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow text-cream/60 mb-4">Connect</div>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:opacity-70">Instagram</a></li>
              <li><a href="#" className="hover:opacity-70">TikTok</a></li>
            </ul>
          </div>
        </div>
        <div className="px-6 md:px-10 py-6 flex flex-col md:flex-row justify-between gap-3 text-xs text-cream/60 max-w-[1200px] mx-auto">
          <p>2026 © Avanti. All rights reserved.</p>
          <div className="flex gap-6 eyebrow">
            <Link href="/terms" className="hover:opacity-80">Terms</Link>
            <Link href="/privacy" className="hover:opacity-80">Privacy</Link>
            <Link href="/cookies" className="hover:opacity-80">Cookies</Link>
            <Link href="/contact" className="hover:opacity-80">Contact</Link>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer style={{ background: 'var(--forest-deep)', padding: `${paddingTop}px 40px 32px`, marginTop: 'auto', color: 'var(--cream)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '32px', marginBottom: '40px', flexWrap: 'wrap' }}>
          {[
            { label: 'How it works', href: '/how-it-works' },
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
            { label: 'Dashboard', href: '/dashboard' },
          ].map(link => (
            <Link
              key={link.label}
              href={link.href}
              style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.6)',
                textDecoration: 'none',
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                letterSpacing: '0.05em',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '0 0 12px' }}>
            2026 © Avanti. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {[
              { label: 'Terms', href: '/terms' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Cookies', href: '/cookies' },
              { label: 'Contact', href: '/contact' },
            ].map(link => (
              <Link
                key={link.label}
                href={link.href}
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.4)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
