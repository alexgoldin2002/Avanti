'use client'

const sections = [
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
]

export default function PrivacyPolicy() {
  return (
    <>
      <p className="eyebrow text-muted-foreground mb-3">Legal</p>
      <h1 className="font-serif text-4xl font-light text-foreground mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-12">Last updated: June 2026</p>

      <div className="flex flex-col gap-8">
        {sections.map((section, i) => (
          <div key={section.title} className={`pb-8 ${i < sections.length - 1 ? 'border-b border-border' : ''}`}>
            <h2 className="font-serif text-xl text-foreground mb-3">{section.title}</h2>
            <p className="text-sm text-foreground/80 leading-relaxed m-0">{section.content}</p>
          </div>
        ))}
      </div>
    </>
  )
}
