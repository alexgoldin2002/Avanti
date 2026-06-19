'use client'

import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import { TIER_LABELS } from '@/lib/destination-decision/client-api'
import { usePlanningPage, LockedGate } from '../planning-shared'

export default function AccommodationPage() {
  const p = usePlanningPage('accommodation')
  if (p.loading) return <SuitcaseLoader message="Loading accommodation" />
  if (!p.locked) return <LockedGate tripId={p.tripId} router={p.router} />

  return (
    <SubpageShell
      backHref={`/trips/${p.tripId}/itinerary`}
      backLabel="Itinerary"
      eyebrow={p.trip?.name}
      title="Accommodation"
      subtitle={`${p.trip.destination}${p.trip.locked_tier ? ` · ${TIER_LABELS[p.trip.locked_tier]}` : ''}`}
      maxWidth="max-w-3xl"
    >
      {!p.data ? (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <p className="font-serif text-xl mb-2">Find stays for your group</p>
          <p className="text-sm text-muted-foreground mb-6">Avanti picks options matched to your locked tier and destination.</p>
          <button type="button" disabled={p.generating} onClick={p.generate} className="avanti-btn avanti-btn-primary">
            {p.generating ? 'Searching…' : 'Suggest places to stay →'}
          </button>
        </div>
      ) : (
        <>
          {p.data.intro && <p className="text-sm italic text-muted-foreground mb-6">{p.data.intro}</p>}
          <div className="space-y-3">
            {(p.data.options || []).map((opt, i) => (
              <div key={i} className="avanti-box border border-border bg-card p-5">
                <div className="flex justify-between gap-2 mb-1">
                  <p className="font-serif text-lg m-0">{String(opt.name)}</p>
                  {opt.price_per_night_usd != null && (
                    <p className="text-sm text-forest-deep shrink-0">${String(opt.price_per_night_usd)}/night</p>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {[opt.type, opt.area].filter(Boolean).join(' · ')}
                </p>
                {opt.why && <p className="text-sm text-muted-foreground m-0 mb-1">{String(opt.why)}</p>}
                {opt.group_fit && <p className="text-xs text-muted-foreground m-0">{String(opt.group_fit)}</p>}
              </div>
            ))}
          </div>
          <button type="button" disabled={p.generating} onClick={p.generate} className="mt-6 w-full avanti-btn avanti-btn-ghost">
            {p.generating ? 'Refreshing…' : '↻ Refresh suggestions'}
          </button>
        </>
      )}
    </SubpageShell>
  )
}
