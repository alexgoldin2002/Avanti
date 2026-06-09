'use client'
import Footer from '../components/Footer'
import AvantiLogo from '../components/AvantiLogo'

export default function About() {
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', flexDirection: 'column', ...s }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px', flex: 1 }}>
        <div style={{ marginBottom: '40px' }}>
          <AvantiLogo size="sm" />
        </div>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 12px' }}>Our story</p>
        <h1 style={{ fontSize: '48px', fontWeight: 300, color: '#083807', margin: '0 0 24px', lineHeight: 1.1, ...s }}>Group travel is an absolute nightmare.</h1>

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
          <div style={{ borderTop: '0.5px solid #e4e4d8', marginTop: '8px', paddingTop: '32px' }}>
            <p style={{ fontSize: '18px', fontStyle: 'italic', color: '#083807', margin: 0, lineHeight: 1.6, ...s }}>
              The trip everyone wanted. The planning nobody did.
            </p>
          </div>
        </div>

        <div style={{ borderTop: '0.5px solid #e4e4d8', paddingTop: '48px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 20px' }}>Built by</p>
          <p style={{ fontSize: '20px', fontWeight: 300, color: '#083807', margin: '0 0 8px', ...s }}>Alexandra Goldin</p>
          <p style={{ fontSize: '14px', color: '#6a6a6a', lineHeight: 1.7 }}>University of Michigan · Economics & Accounting · Class of 2026</p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
