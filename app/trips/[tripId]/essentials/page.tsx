'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import { generateAppsClient, generateEssentialsClient } from '@/lib/trip-companion/client-api'
import type { CountryAppsGuide, DestinationEssentials } from '@/lib/trip-companion/types'

export default function TripEssentialsPage() {
  const { tripId } = useParams() as { tripId: string }
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [essentials, setEssentials] = useState<DestinationEssentials | null>(null)
  const [apps, setApps] = useState<CountryAppsGuide | null>(null)
  const [generating, setGenerating] = useState<'essentials' | 'apps' | null>(null)
  const [tab, setTab] = useState<'safety' | 'apps'>('safety')

  const load = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase')
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    setTrip(tripData)
    const companion = tripData?.options?.companion || {}
    setEssentials(companion.essentials || null)
    setApps(companion.country_apps || null)
    setLoading(false)
  }, [tripId])

  useEffect(() => { load().catch(console.error) }, [load])

  const genEssentials = async () => {
    setGenerating('essentials')
    try {
      const data = await generateEssentialsClient(tripId)
      setEssentials(data)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setGenerating(null)
    }
  }

  const genApps = async () => {
    setGenerating('apps')
    try {
      const data = await generateAppsClient(tripId)
      setApps(data)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setGenerating(null)
    }
  }

  if (loading) return <SuitcaseLoader message="Loading essentials" />

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={trip?.name}
      title="Destination essentials"
      subtitle={trip?.destination || ''}
      maxWidth="max-w-2xl"
    >
      <div className="flex gap-2 mb-6 border-b border-border">
        {(['safety', 'apps'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-2 text-xs tracking-[0.2em] uppercase transition-colors ${
              tab === t ? 'text-foreground border-b-2 border-foreground -mb-px' : 'text-muted-foreground'
            }`}
          >
            {t === 'safety' ? 'Safety & embassy' : 'Local apps'}
          </button>
        ))}
      </div>

      {tab === 'safety' && (
        <>
          {!essentials ? (
            <div className="avanti-box border border-border bg-card px-6 py-10 text-center">
              <p className="font-serif text-lg mb-2">Emergency info & embassies</p>
              <p className="text-sm text-muted-foreground mb-6">
                Emergency numbers, nearest hospital to your hotel, and embassy contacts for your group&apos;s nationalities.
              </p>
              <button type="button" disabled={generating === 'essentials'} onClick={genEssentials} className="avanti-btn avanti-btn-primary">
                {generating === 'essentials' ? 'Generating…' : 'Generate essentials →'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="avanti-box border border-forest-deep/30 bg-forest-pale px-5 py-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Emergency</p>
                <p className="font-serif text-2xl text-forest-deep m-0">{essentials.emergency_number}</p>
                {(essentials.police_number || essentials.ambulance_number) && (
                  <p className="text-xs text-muted-foreground mt-2 m-0">
                    {[essentials.police_number && `Police ${essentials.police_number}`, essentials.ambulance_number && `Ambulance ${essentials.ambulance_number}`].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              {essentials.hospitals?.length > 0 && (
                <section>
                  <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Nearest hospitals</p>
                  {essentials.hospitals.map((h, i) => (
                    <div key={i} className="avanti-box border border-border bg-card px-4 py-3 mb-2">
                      <p className="text-sm font-medium m-0">{h.name}</p>
                      <p className="text-xs text-muted-foreground m-0 mt-1">{h.address}</p>
                      <p className="text-xs m-0 mt-1">{h.phone}{h.distance_from_hotel ? ` · ${h.distance_from_hotel}` : ''}</p>
                    </div>
                  ))}
                </section>
              )}

              {essentials.embassies?.length > 0 && (
                <section>
                  <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Embassies & consulates</p>
                  {essentials.embassies.map((e, i) => (
                    <div key={i} className="avanti-box border border-border bg-card px-4 py-3 mb-2">
                      <p className="text-sm font-medium m-0">{e.name} ({e.nationality})</p>
                      <p className="text-xs text-muted-foreground m-0 mt-1">{e.address}</p>
                      <p className="text-xs m-0 mt-1">{e.phone}{e.emergency_line ? ` · Emergency ${e.emergency_line}` : ''}</p>
                      {e.hours && <p className="text-xs text-muted-foreground m-0 mt-0.5">{e.hours}</p>}
                    </div>
                  ))}
                </section>
              )}

              {essentials.general_tips?.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                  {essentials.general_tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              )}

              <button type="button" disabled={generating === 'essentials'} onClick={genEssentials} className="avanti-btn avanti-btn-ghost w-full">
                {generating === 'essentials' ? 'Refreshing…' : '↻ Refresh essentials'}
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'apps' && (
        <>
          {!apps ? (
            <div className="avanti-box border border-border bg-card px-6 py-10 text-center">
              <p className="font-serif text-lg mb-2">Apps locals actually use</p>
              <p className="text-sm text-muted-foreground mb-6">
                Rideshare, transit, food delivery, maps, and taxi numbers for {trip?.destination}.
              </p>
              <button type="button" disabled={generating === 'apps'} onClick={genApps} className="avanti-btn avanti-btn-primary">
                {generating === 'apps' ? 'Generating…' : 'Generate app guide →'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {apps.tips?.length > 0 && (
                <div className="avanti-box border border-forest-deep/20 bg-forest-pale px-4 py-3">
                  {apps.tips.map((t, i) => <p key={i} className="text-xs m-0 mb-1 last:mb-0">{t}</p>)}
                </div>
              )}
              {apps.transit_numbers?.length > 0 && (
                <p className="text-sm text-muted-foreground m-0">
                  <span className="uppercase text-[10px] tracking-wider block mb-1">Useful numbers</span>
                  {apps.transit_numbers.join(' · ')}
                </p>
              )}
              {apps.apps?.map((app, i) => (
                <div key={i} className="avanti-box border border-border bg-card px-4 py-3">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium m-0">{app.name}</p>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{app.category.replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 m-0">{app.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 m-0">{app.platforms?.join(' · ')}</p>
                </div>
              ))}
              <button type="button" disabled={generating === 'apps'} onClick={genApps} className="avanti-btn avanti-btn-ghost w-full">
                {generating === 'apps' ? 'Refreshing…' : '↻ Refresh app guide'}
              </button>
            </div>
          )}
        </>
      )}
    </SubpageShell>
  )
}
