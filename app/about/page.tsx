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
        <h1 style={{ fontSize: '48px', fontWeight: 300, color: '#083807', margin: '0 0 24px', lineHeight: 1.1, ...s }}>Built for the person who always ends up planning the trip.</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '64px' }}>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            Every group has one. The person who spends 40 hours in Google Docs, chasing people for availability, comparing hotels across six tabs, and still gets blamed when someone doesn't like the itinerary.
          </p>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            Avanti was built because that person deserves better. Not just a smarter checklist — but an actual thinking partner that knows what questions to ask, what costs to flag, and what smart moves most people miss.
          </p>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            We believe you can have a better trip than you think you can. Not by spending more — but by knowing what you have access to. The credit card benefit nobody read. The ferry that's faster and cheaper than the flight. The hotel that's $80 cheaper because it's two streets over and still walkable to everything.
          </p>
          <p style={{ fontSize: '16px', color: '#3a3a3a', margin: 0, lineHeight: 1.9 }}>
            Avanti thinks about all of it. You just show up.
          </p>
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
