'use client'

import { useRouter } from 'next/navigation'
import SubpageShell from '../components/SubpageShell'

const FEATURE_GROUPS = [
  {
    label: 'Profile & planning',
    items: [
      {
        href: '/features/expense-splitting',
        title: 'Split expenses',
        subtitle: 'Receipts, line items, and who owes what',
        icon: 'ti-divide',
      },
      {
        href: '/features/travel-benefits',
        title: 'Travel benefits',
        subtitle: 'Cards, status, lounges — surfaced when it matters',
        icon: 'ti-credit-card',
      },
    ],
  },
  {
    label: 'Game time',
    items: [
      {
        href: '/features/game-time',
        title: 'Game time hub',
        subtitle: 'Full itinerary, flights, hotels, and confirmations',
        icon: 'ti-clock-hour-4',
        highlight: true,
      },
      {
        href: '/features/saved-places',
        title: 'Saved places',
        subtitle: 'TikTok, Instagram, links & screenshots → best time to go',
        icon: 'ti-bookmark',
      },
      {
        href: '/features/bookings',
        title: 'Bookings vault',
        subtitle: 'Forward emails · upload PDFs · all QR codes',
        icon: 'ti-ticket',
      },
      {
        href: '/features/essentials',
        title: 'Destination essentials',
        subtitle: 'Emergency, hospital, embassy, local apps',
        icon: 'ti-shield-check',
      },
      {
        href: '/features/briefings',
        title: 'Daily briefings',
        subtitle: 'Night preview · morning schedule · SMS',
        icon: 'ti-bell-ringing',
      },
    ],
  },
] as const

const ALL_FEATURES = FEATURE_GROUPS.flatMap(g => g.items)

export default function Features() {
  const router = useRouter()

  return (
    <SubpageShell
      backHref="/dashboard"
      backLabel="Dashboard"
      eyebrow="Tools for your trips"
      title="Features"
      subtitle="Pick a tool, then choose a trip. Game-time features also live on each trip under the Game time tab."
      maxWidth="max-w-3xl"
    >
      {/* Quick-launch grid — live features only */}
      <section className="mb-10">
        <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-4">Quick launch</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {ALL_FEATURES.map(item => (
            <button
              key={item.href}
              type="button"
              title={item.title}
              onClick={() => router.push(item.href)}
              className="group avanti-box flex flex-col items-center justify-center gap-2 rounded-none border border-border bg-forest-pale/40 px-2 py-4 aspect-square transition-all duration-200 hover:-translate-y-px hover:border-forest-deep/40 hover:bg-forest-pale hover:[box-shadow:var(--shadow-box-hover)]"
            >
              <i className={`ti ${item.icon} text-xl text-forest-deep transition-transform duration-200 group-hover:scale-110`} aria-hidden />
              <span className="text-[9px] leading-tight tracking-wide uppercase text-muted-foreground text-center line-clamp-2 group-hover:text-foreground">
                {item.title.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Grouped list */}
      <div className="space-y-10">
        {FEATURE_GROUPS.map(group => (
          <section key={group.label}>
            <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">{group.label}</p>
            <div className="flex flex-col gap-2">
              {group.items.map(item => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={`group avanti-box flex w-full items-center justify-between rounded-none border bg-card px-5 py-4 text-left transition-all duration-200 hover:-translate-y-px hover:[box-shadow:var(--shadow-box-hover)] ${
                    'highlight' in item && item.highlight
                      ? 'border-forest-deep hover:border-forest-deep'
                      : 'border-border hover:border-forest-deep/30'
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-none bg-forest-deep text-cream transition-transform duration-200 group-hover:scale-105">
                      <i className={`ti ${item.icon} text-lg`} aria-hidden />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="font-serif text-lg text-foreground m-0 transition-colors duration-200 group-hover:text-forest-deep">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 m-0">{item.subtitle}</p>
                    </div>
                  </div>
                  <i className="ti ti-chevron-right text-muted-foreground shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-forest-deep" aria-hidden />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="avanti-box mt-12 rounded-none border border-forest-deep/20 bg-forest-mist px-5 py-4">
        <p className="text-sm text-muted-foreground m-0 font-serif italic leading-relaxed">
          More tools on the way — each square above is live today. Open any trip and tap{' '}
          <span className="text-foreground not-italic">Game time</span> for the full on-trip experience.
        </p>
      </div>
    </SubpageShell>
  )
}
