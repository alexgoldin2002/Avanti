'use client'

const sections = [
  { title: 'What are cookies', content: 'Cookies are small text files stored on your device when you visit a website. They help us remember your preferences and keep you signed in.' },
  { title: 'What we use', content: 'Avanti uses only essential cookies required for the app to function — specifically, authentication cookies that keep you signed in to your account. We do not use advertising cookies, tracking cookies, or analytics cookies that share data with third parties.' },
  { title: 'Your choices', content: 'Because we only use essential cookies, the app cannot function without them. If you disable cookies in your browser, you will not be able to sign in to Avanti.' },
  { title: 'Contact', content: 'For questions about our cookie use, email privacy@avanti.app.' },
]

export default function CookiePreferences() {
  return (
    <>
      <p className="eyebrow text-muted-foreground mb-3">Legal</p>
      <h1 className="font-serif text-4xl font-light text-foreground mb-2">Cookie Preferences</h1>
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
