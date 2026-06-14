'use client'
import Footer from '../components/Footer'
import AvantiLogo from '../components/AvantiLogo'

export default function About() {
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', ...s }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px', flex: 1 }}>
        <div style={{ marginBottom: '40px' }}>
          <AvantiLogo size="sm" />
        </div>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>Our story</p>
        <h1 style={{ fontSize: '48px', fontWeight: 300, color: 'var(--forest-deep)', margin: '0 0 24px', lineHeight: 1.1, ...s }}>Group travel is an absolute nightmare.</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '64px' }}>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            Too many people. Too many opinions. Too many moving parts. And somehow it all lands on one person.
          </p>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            Avanti handles the hard parts. The decisions nobody wants to finalize. The back-and-forth. The money, the logistics. The nudging people to voice an opinion or fill out their information and vote. The reminding. The tracking. And everything in between.
          </p>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            And for everyone in the group — whether you&apos;re the one who checks every detail or the one who says &ldquo;I&apos;m honestly up for anything&rdquo; — Avanti makes sure you have exactly as much say as you want. No more, no less.
          </p>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            When it&apos;s time to decide, Avanti makes the call. So nobody has to be the bad guy.
          </p>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            At the same time, Avanti is finding everything you didn&apos;t know to look for. The hidden benefits. The smarter route. The better hotel. The trip that&apos;s more enjoyable, more affordable, and more you — than anything the group chat could have figured out on its own.
          </p>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            You can have a better trip than you think you can. Avanti makes sure of it.
          </p>
          <p style={{ fontSize: '18px', fontStyle: 'italic', color: 'var(--forest-deep)', margin: 0, lineHeight: 1.6, ...s }}>
            The trip everyone wanted. The planning nobody did.
          </p>
        </div>

        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: 300, color: 'var(--foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Alexandra Goldin
            </span>
            <a href="https://www.linkedin.com/in/alexandragoldin" target="_blank" rel="noopener noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--muted-foreground)" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '4px 0 0', letterSpacing: '0.05em', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            UMich &apos;26
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
