'use client'
import Footer from '../components/Footer'
import AvantiLogo from '../components/AvantiLogo'

export default function CookiePreferences() {
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', ...s }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px', flex: 1 }}>
        <div style={{ marginBottom: '40px' }}>
          <AvantiLogo size="sm" />
        </div>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>Legal</p>
        <h1 style={{ fontSize: '40px', fontWeight: 300, color: 'var(--forest-deep)', margin: '0 0 8px', ...s }}>Cookie Preferences</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 48px' }}>Last updated: June 2026</p>
        {[
          { title: 'What are cookies', content: 'Cookies are small text files stored on your device when you visit a website. They help us remember your preferences and keep you signed in.' },
          { title: 'What we use', content: 'Avanti uses only essential cookies required for the app to function — specifically, authentication cookies that keep you signed in to your account. We do not use advertising cookies, tracking cookies, or analytics cookies that share data with third parties.' },
          { title: 'Your choices', content: 'Because we only use essential cookies, the app cannot function without them. If you disable cookies in your browser, you will not be able to sign in to Avanti.' },
          { title: 'Contact', content: 'For questions about our cookie use, email privacy@avanti.app.' },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 400, color: 'var(--forest-deep)', margin: '0 0 10px', ...s }}>{section.title}</h2>
            <p style={{ fontSize: '14px', color: '#3a3a3a', margin: 0, lineHeight: 1.8 }}>{section.content}</p>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  )
}
