'use client'

import { useEffect, useState } from 'react'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import BookSearchLink from '../../../components/BookSearchLink'
import { getYourGuideSearchUrl } from '@/lib/booking/search-links'
import { fetchLiveActivities } from '@/lib/activities/client-api'
import { usePlanningPage, LockedGate } from '../planning-shared'

export default function ActivitiesPage() {
  const p = usePlanningPage('activities')
  const [liveBusy, setLiveBusy] = useState(false)
  const [live, setLive] = useState<Awaited<ReturnType<typeof fetchLiveActivities>> | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)

  useEffect(() => {
    if (!p.locked || p.loading) return
    let cancelled = false
    ;(async () => {
      setLiveBusy(true)
      setLiveError(null)
      try {
        const result = await fetchLiveActivities(p.tripId)
        if (!cancelled) setLive(result)
      } catch (e) {
        if (!cancelled) setLiveError(e instanceof Error ? e.message : 'Failed to load activities')
      } finally {
        if (!cancelled) setLiveBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [p.tripId, p.locked, p.loading])

  if (p.loading) return <SuitcaseLoader message="Loading activities" />
  if (!p.locked) return <LockedGate tripId={p.tripId} router={p.router} />

  const refreshLive = async () => {
    setLiveBusy(true)
    setLiveError(null)
    try {
      setLive(await fetchLiveActivities(p.tripId))
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Failed to search activities')
    } finally {
      setLiveBusy(false)
    }
  }

  return (
    <SubpageShell
      backHref={`/trips/${p.tripId}/itinerary`}
      backLabel="Itinerary"
      eyebrow={p.trip?.name}
      title="Activities"
      subtitle={p.trip.destination}
      maxWidth="max-w-3xl"
    >
      <div className="avanti-box border border-border bg-card p-5 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground mb-1">Book tours &amp; experiences</p>
            <p className="text-sm text-muted-foreground m-0">
              Live inventory from GetYourGuide when configured — book, then add confirmation to your vault.
            </p>
          </div>
          <button
            type="button"
            disabled={liveBusy}
            onClick={refreshLive}
            className="avanti-btn avanti-btn-primary shrink-0"
          >
            {liveBusy ? 'Searching…' : 'Refresh live tours →'}
          </button>
        </div>

        {liveError && <p className="text-sm text-red-700 mt-4 mb-0">{liveError}</p>}

        {live && !live.configured && (
          <div className="text-sm text-muted-foreground mt-4">
            <p className="mb-2">
              Add <code className="text-xs">GETYOURGUIDE_ACCESS_TOKEN</code> in Vercel after partner signup at{' '}
              <a href="https://partner.getyourguide.com/" target="_blank" rel="noopener noreferrer" className="underline">
                partner.getyourguide.com
              </a>
              .
            </p>
            {live.fallbackSearchUrl && (
              <BookSearchLink href={live.fallbackSearchUrl} label="Search GetYourGuide →" />
            )}
          </div>
        )}

        {live && live.configured && live.offers.length === 0 && !liveError && (
          <p className="text-sm text-muted-foreground mt-4 mb-0">No tours found for this destination — try AI suggestions below.</p>
        )}

        {live && live.offers.length > 0 && (
          <div className="space-y-3 mt-5 border-t border-border pt-5">
            {live.offers.map(offer => (
              <div key={offer.tourId} className="flex flex-wrap gap-4 border border-border/60 px-4 py-3">
                {offer.pictureUrl && (
                  <img
                    src={offer.pictureUrl}
                    alt=""
                    className="w-20 h-20 object-cover rounded shrink-0 bg-forest-mist"
                  />
                )}
                <div className="flex-1 min-w-[200px]">
                  <p className="font-serif text-base m-0">{offer.title}</p>
                  <p className="text-xs text-muted-foreground m-0 mt-1">
                    {[
                      offer.durationLabel,
                      offer.rating != null && `${offer.rating}/5`,
                      offer.reviewCount != null && `${offer.reviewCount} reviews`,
                      offer.bestseller && 'Bestseller',
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {offer.abstract && (
                    <p className="text-sm text-muted-foreground m-0 mt-2 line-clamp-2">{offer.abstract}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {offer.priceFromUsd != null && (
                    <p className="font-serif text-lg text-forest-deep m-0">From ${Math.round(offer.priceFromUsd)}</p>
                  )}
                  {offer.bookUrl && (
                    <BookSearchLink href={offer.bookUrl} label="Book →" className="mt-2" variant="primary" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!p.data ? (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <p className="font-serif text-xl mb-2">What should your group do?</p>
          <p className="text-sm text-muted-foreground mb-6">AI picks based on your destination and trip vibe — pair with live tours above.</p>
          <button type="button" disabled={p.generating} onClick={p.generate} className="avanti-btn avanti-btn-primary">
            {p.generating ? 'Planning…' : 'Suggest activities →'}
          </button>
        </div>
      ) : (
        <>
          {p.data.intro && <p className="text-sm italic text-muted-foreground mb-6">{p.data.intro}</p>}
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Group ideas (AI)</p>
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
                {live?.destination && (
                  <div className="pt-3 mt-3 border-t border-border/60">
                    <BookSearchLink
                      href={getYourGuideSearchUrl(live.destination, String(opt.name), { pubref: p.tripId, label: 'activities' })}
                      label="Find on GetYourGuide →"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" disabled={p.generating} onClick={p.generate} className="mt-6 w-full avanti-btn avanti-btn-ghost">
            {p.generating ? 'Refreshing…' : '↻ Refresh suggestions'}
          </button>
        </>
      )}

      <div className="mt-8 avanti-box border border-border bg-forest-mist/40 p-5 text-center">
        <p className="font-serif text-lg mb-2">After you book</p>
        <p className="text-sm text-muted-foreground mb-4">Forward confirmation email or upload — it merges into the group itinerary.</p>
        <button type="button" onClick={() => p.router.push(`/trips/${p.tripId}/bookings`)} className="avanti-btn avanti-btn-primary">
          Trip vault →
        </button>
      </div>
    </SubpageShell>
  )
}
