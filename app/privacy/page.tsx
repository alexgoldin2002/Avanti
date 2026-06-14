'use client'
import Footer from '../components/Footer'
import AvantiLogo from '../components/AvantiLogo'
import Link from 'next/link'

export default function PrivacyPolicy() {
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', ...s }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px', flex: 1 }}>
        <div style={{ marginBottom: '40px' }}>
          <AvantiLogo size="sm" />
        </div>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>Legal</p>
        <h1 style={{ fontSize: '40px', fontWeight: 300, color: 'var(--forest-deep)', margin: '0 0 8px', ...s }}>Privacy Policy</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 48px' }}>Last updated: June 2026</p>

        {[
          { title: 'Who we are', content: 'Avanti is a group travel planning platform that helps friends and families plan trips together. We are based in the United States. If you have questions about this policy, contact us at privacy@avanti.app.' },
          { title: 'What we collect', content: 'We collect information you provide directly: your name, email address, phone number, date of birth, passport number, TSA PreCheck number, home address, and credit card membership information (card names only — not card numbers). We also collect information about how you use Avanti, including trips you create, messages you send, and votes you participate in.' },
          { title: 'Why we collect it', content: 'We use your information to provide the Avanti service — creating and managing group trips, coordinating with other travelers, and generating travel recommendations. We do not sell your personal information to third parties. We do not use your information for advertising.' },
          { title: 'Passport and travel document information', content: 'Passport numbers and travel document information are stored securely and used only to facilitate trip planning within Avanti. This information is never shared with third parties except as required to complete a booking you have explicitly authorized.' },
          { title: 'Data storage and security', content: 'Your data is stored securely using Supabase, a cloud database provider. We use industry-standard encryption for data in transit and at rest. We retain your data for as long as your account is active. You can request deletion of your account and all associated data at any time.' },
          { title: 'Sharing your information', content: 'When you join a trip, certain profile information (your name, nickname, and departure city) is visible to other members of that trip. Your passport number, address, and financial information are never visible to other users.' },
          { title: 'Your rights', content: 'You have the right to access, correct, or delete your personal information at any time. You can update your profile information from your account settings. To request full account deletion, contact us at privacy@avanti.app.' },
          { title: 'California residents', content: 'If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete your personal information, and the right to opt out of the sale of your personal information. We do not sell personal information. To exercise your rights, contact privacy@avanti.app.' },
          { title: 'Changes to this policy', content: 'We may update this privacy policy from time to time. We will notify you of significant changes by email or by a notice in the Avanti app. Your continued use of Avanti after changes take effect constitutes your acceptance of the updated policy.' },
          { title: 'Contact us', content: 'For privacy-related questions or requests, email privacy@avanti.app.' },
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
