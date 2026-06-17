'use client'
import Link from 'next/link'

const steps = [
  { number: '01', title: 'Create your trip', description: 'Name your trip, set a vibe, and invite your group. Everyone joins with one link and fills in their own preferences — departure city, dates, travel documents.' },
  { number: '02', title: 'Tell Avanti what you want', description: "Have a conversation with Avanti about your trip. Where you're thinking, what kind of experience you want, what matters most. Avanti asks only what it needs and thinks about the rest." },
  { number: '03', title: 'Avanti does the work', description: "Avanti analyzes everyone's preferences, finds the smart moves your group has access to, flags the hidden costs, and comes back with real options — not generic suggestions." },
  { number: '04', title: 'Group votes, you decide', description: 'Send options to your group to vote on. Everyone weighs in by the deadline. You lock in the winner. Avanti moves to the next decision.' },
  { number: '05', title: 'You just show up', description: 'Avanti keeps building out the trip — accommodation, activities, dining. Everything in one place for the whole group. No more 47-message group chats.' },
]

export default function HowItWorks() {
  return (
    <>
      <p className="eyebrow text-muted-foreground mb-3">How it works</p>
      <h1 className="font-serif text-4xl sm:text-5xl font-light text-foreground mb-4 leading-tight">
        The best trips start here.
      </h1>
      <p className="text-base text-muted-foreground mb-16 leading-relaxed max-w-xl">
        Avanti is the AI travel companion that thinks like a great travel agent — and coordinates your whole group.
      </p>

      <div className="flex flex-col">
        {steps.map((step, i) => (
          <div
            key={step.number}
            className="relative ml-5 pl-8 pb-10 border-l border-forest-deep/15 last:border-l-0 last:pb-0 group"
          >
            <div className="absolute -left-5 top-0 grid h-10 w-10 place-items-center rounded-none bg-forest-deep text-cream avanti-box transition-transform duration-200 group-hover:scale-105">
              <span className="font-serif text-sm">{step.number}</span>
            </div>
            <div className="pt-1">
              <h3 className="font-serif text-xl text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="avanti-box mt-12 rounded-none bg-forest-deep text-cream border-forest-deep px-8 py-10 text-center">
        <h2 className="font-serif text-2xl sm:text-3xl font-light mb-3">Ready to plan your next trip?</h2>
        <p className="text-sm text-cream/70 mb-6">Free during beta. No credit card required.</p>
        <Link href="/" className="avanti-btn-primary inline-block no-underline hover:-translate-y-px transition-transform">
          Get started →
        </Link>
      </div>
    </>
  )
}
