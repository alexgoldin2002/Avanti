'use client'
import Link from 'next/link'

export default function Footer() {
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  return (
    <footer style={{ background: '#0a1f0a', padding: '48px 40px 32px', marginTop: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        <div style={{ display: 'flex', gap: '32px', marginBottom: '40px', flexWrap: 'wrap' }}>
          {[
            { label: 'How it works', href: '/how-it-works' },
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
            { label: 'Dashboard', href: '/dashboard' },
          ].map(link => (
            <Link key={link.label} href={link.href}
              style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif', letterSpacing: '0.05em' }}>
              {link.label}
            </Link>
          ))}
        </div>

        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px', ...s }}>Connect</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { name: 'TikTok', href: '#', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/></svg>
              )},
              { name: 'YouTube', href: '#', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
              )},
              { name: 'Instagram', href: '#', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              )},
              { name: 'Facebook', href: '#', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              )},
            ].map(social => (
              <a key={social.name} href={social.href} aria-label={social.name}
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'background 0.2s' }}>
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0, ...s }}>
            2026 © Avanti. All Rights Reserved.
          </p>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {[
              { label: 'Terms', href: '/terms' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Cookie preferences', href: '/cookies' },
              { label: 'CA privacy rights', href: '/privacy' },
              { label: 'Contact', href: '/contact' },
            ].map(link => (
              <Link key={link.label} href={link.href}
                style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', ...s }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </footer>
  )
}
