'use client'
import Footer from '../components/Footer'
import AvantiLogo from '../components/AvantiLogo'
import Link from 'next/link'

export default function HowItWorks() {
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const steps = [
    { number: '01', title: 'Create your trip', description: 'Name your trip, set a vibe, and invite your group. Everyone joins with one link and fills in their own preferences — departure city, dates, travel documents.' },
    { number: '02', title: 'Tell Avanti what you want', description: 'Have a conversation with Avanti about your trip. Where you\'re thinking, what kind of experience you want, what matters most. Avanti asks only what it needs and thinks about the rest.' },
    { number: '03', title: 'Avanti does the work', description: 'Avanti analyzes everyone\'s preferences, finds the smart moves your group has access to, flags the hidden costs, and comes back with real options — not generic suggestions.' },
    { number: '04', title: 'Group votes, you decide', description: 'Send options to your group to vote on. Everyone weighs in by the deadline. You lock in the winner. Avanti moves to the next decision.' },
    { number: '05', title: 'You just show up', description: 'Avanti keeps building out the trip — accommodation, activities, dining. Everything in one place for the whole group. No more 47-message group chats.' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', flexDirection: 'column', ...s }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px', flex: 1 }}>
        <div style={{ marginBottom: '40px' }}>
          <AvantiLogo size="sm" />
        </div>

        <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 12px' }}>How it works</p>
        <h1 style={{ fontSize: '48px', fontWeight: 300, color: '#083807', margin: '0 0 16px', lineHeight: 1.1, ...s }}>The best trips start here.</h1>
        <p style={{ fontSize: '16px', color: '#6a6a6a', margin: '0 0 64px', lineHeight: 1.7 }}>Avanti is the AI travel companion that thinks like a great travel agent — and coordinates your whole group.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {steps.map((step, i) => (
            <div key={step.number} style={{ display: 'flex', gap: '32px', paddingBottom: '40px', borderLeft: i < steps.length - 1 ? '0.5px solid #e4e4d8' : 'none', marginLeft: '20px', paddingLeft: '32px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-20px', top: '0', width: '40px', height: '40px', borderRadius: '50%', background: '#083807', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 300, ...s }}>{step.number}</span>
              </div>
              <div style={{ paddingTop: '8px' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 300, color: '#083807', margin: '0 0 10px', ...s }}>{step.title}</h3>
                <p style={{ fontSize: '14px', color: '#6a6a6a', margin: 0, lineHeight: 1.8 }}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#083807', borderRadius: '12px', padding: '40px', textAlign: 'center', marginTop: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 300, color: '#fff', margin: '0 0 12px', ...s }}>Ready to plan your next trip?</h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', margin: '0 0 24px' }}>Free during beta. No credit card required.</p>
          <Link href="/" style={{ display: 'inline-block', background: '#fff', color: '#083807', padding: '14px 32px', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Get started →
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
