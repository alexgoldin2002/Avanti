'use client'

const contacts = [
  { label: 'General', email: 'hello@avanti.app' },
  { label: 'Privacy & data', email: 'privacy@avanti.app' },
  { label: 'Legal', email: 'legal@avanti.app' },
  { label: 'Press', email: 'press@avanti.app' },
]

export default function Contact() {
  return (
    <>
      <p className="eyebrow text-muted-foreground mb-3">Get in touch</p>
      <h1 className="font-serif text-4xl font-light text-foreground mb-4">Contact</h1>
      <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
        We&apos;d love to hear from you — feedback, questions, partnership inquiries, or just to say hi.
      </p>

      <div className="flex flex-col gap-3">
        {contacts.map(item => (
          <div
            key={item.label}
            className="avanti-box group flex justify-between items-center rounded-none border border-border bg-card px-5 py-4 transition-all duration-200 hover:-translate-y-px hover:[box-shadow:var(--shadow-box-hover)] hover:border-forest-deep/30"
          >
            <p className="font-serif text-base text-foreground m-0">{item.label}</p>
            <a href={`mailto:${item.email}`} className="text-sm text-forest-deep no-underline transition-colors group-hover:text-forest-soft">
              {item.email}
            </a>
          </div>
        ))}
      </div>
    </>
  )
}
