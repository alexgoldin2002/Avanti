'use client'

import Link from 'next/link'
import {
  DESTINATION_CONSIDERATIONS,
  UPCOMING_CONSIDERATION_PHASES,
} from '@/lib/travel-considerations/destinations'

export default function DestinationConsiderationsPage() {
  return (
    <>
      <p className="eyebrow text-muted-foreground mb-3">Why us?</p>
      <h1 className="font-serif text-4xl sm:text-5xl font-light text-foreground mb-4 leading-tight">
        What we consider when finding a destination
      </h1>
      <p className="text-base text-muted-foreground mb-12 leading-relaxed max-w-xl">
        Avanti is programmed to think through every factor below — before you ever see a card or a comparison row.
        You answer a few questions; we handle the rest.
      </p>

      <div className="flex flex-col gap-10 mb-16">
        {DESTINATION_CONSIDERATIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-serif text-xl text-foreground mb-4">{section.title}</h2>
            <ul className="flex flex-col gap-2.5">
              {section.items.map((item) => (
                <li
                  key={item.slice(0, 48)}
                  className="text-sm text-muted-foreground leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-forest-deep/40"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="avanti-box rounded-none border border-border bg-forest-mist px-6 py-5 mb-12">
        <p className="text-sm text-foreground/85 leading-relaxed mb-3">
          More lists coming soon — what we consider when booking travel, choosing accommodation, and building out your trip.
        </p>
        <ul className="flex flex-col gap-1.5">
          {UPCOMING_CONSIDERATION_PHASES.map((phase) => (
            <li key={phase} className="text-xs text-muted-foreground tracking-wide">
              {phase}
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/why-us"
        className="text-sm text-forest-deep hover:opacity-70 transition-opacity no-underline"
      >
        ← Back to Why us?
      </Link>
    </>
  )
}
