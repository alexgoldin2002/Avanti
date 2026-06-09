'use client'
import Footer from '../components/Footer'
import AvantiLogo from '../components/AvantiLogo'

export default function Contact() {
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', flexDirection: 'column', ...s }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px', flex: 1 }}>
        <div style={{ marginBottom: '40px' }}>
          <AvantiLogo size="sm" />
        </div>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 12px' }}>Get in touch</p>
        <h1 style={{ fontSize: '40px', fontWeight: 300, color: '#083807', margin: '0 0 16px', ...s }}>Contact</h1>
        <p style={{ fontSize: '15px', color: '#6a6a6a', margin: '0 0 48px', lineHeight: 1.8 }}>We'd love to hear from you — feedback, questions, partnership inquiries, or just to say hi.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {[
            { label: 'General', email: 'hello@avanti.app' },
            { label: 'Privacy & data', email: 'privacy@avanti.app' },
            { label: 'Legal', email: 'legal@avanti.app' },
            { label: 'Press', email: 'press@avanti.app' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '10px' }}>
              <p style={{ fontSize: '14px', color: '#1a1a1a', margin: 0, ...s }}>{item.label}</p>
              <a href={`mailto:${item.email}`} style={{ fontSize: '13px', color: '#083807', textDecoration: 'none', ...s }}>{item.email}</a>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
