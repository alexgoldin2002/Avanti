'use client'

import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import { usePlanningPage, LockedGate } from '../planning-shared'

export default function ActivitiesPage() {
  const p = usePlanningPage('activities')
  if (p.loading) return <SuitcaseLoader message="Loading activities" />
  if (!p.locked) return <LockedGate tripId={p.tripId} router={p.router} />

  return (
    <SubpageShell
      backHref={`/trips/${p.tripId}/itinerary`}
      backLabel="Itinerary"
      eyebrow={p.trip?.name}
      title="Activities"
      subtitle={p.trip.destination}
      maxWidth="max-w-3xl"
    >
      {!p.data ? (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <p className="font-serif text-xl mb-2">What should your group do?</p>
          <p className="text-sm text-muted-foreground mb-6">Curated activities based on your destination and trip vibe.</p>
          <button type="button" disabled={p.generating} onClick={p.generate} className="avanti-btn avanti-btn-primary">
            {p.generating ? 'Planning…' : 'Suggest activities →'}
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
                  {opt.cost_per_person_usd != null && (
                    <p className="text-sm text-forest-deep shrink-0">~${String(opt.cost_per_person_usd)}/pp</p>
                  )}
                </div>
                {opt.duration && (
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{String(opt.duration)}</p>
                )}
                {opt.why && <p className="text-sm text-muted-foreground m-0 mb-1">{String(opt.why)}</p>}
                {opt.best_for && <p className="text-xs text-muted-foreground m-0">{String(opt.best_for)}</p>}
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
