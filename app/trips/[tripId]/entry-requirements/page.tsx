'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import { generateEntryRequirementsClient } from '@/lib/trip-companion/client-api'
import type { EntryRequirements, MedicationAdvisory } from '@/lib/trip-companion/types'

const MED_STATUS: Record<MedicationAdvisory['status'], { label: string; cls: string }> = {
  ok: { label: 'Allowed', cls: 'bg-forest-pale text-forest-deep border-forest-deep/30' },
  restricted: { label: 'Restricted', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  banned: { label: 'Banned', cls: 'bg-red-50 text-red-800 border-red-300' },
  bring_supply: { label: 'Bring supply', cls: 'bg-blue-50 text-blue-800 border-blue-300' },
  unknown: { label: 'Check locally', cls: 'bg-muted text-muted-foreground border-border' },
}

export default function TripEntryRequirementsPage() {
  const { tripId } = useParams() as { tripId: string }
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<{ name?: string; destination?: string } | null>(null)
  const [data, setData] = useState<EntryRequirements | null>(null)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'entry' | 'health'>('entry')

  const load = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase')
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    setTrip(tripData)
    const companion = tripData?.options?.companion || {}
    setData(companion.entry_requirements || null)
    setLoading(false)
  }, [tripId])

  useEffect(() => { load().catch(console.error) }, [load])

  const generate = async () => {
    setGenerating(true)
    try {
      const result = await generateEntryRequirementsClient(tripId)
      setData(result)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <SuitcaseLoader message="Loading entry requirements" />

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={trip?.name}
      title="Entry requirements"
      subtitle={trip?.destination || ''}
      maxWidth="max-w-2xl"
    >
      {!data ? (
        <div className="avanti-box border border-border bg-card px-6 py-10 text-center">
          <p className="font-serif text-lg mb-2">Visas, documents, vaccines & medications</p>
          <p className="text-sm text-muted-foreground mb-6">
            We&apos;ll check {trip?.destination || 'your destination'} against your group&apos;s nationalities and your saved
            medications, then list what to prepare — visas, required documents, vaccines, and which medications need paperwork
            or should be brought from home.
          </p>
          <button type="button" disabled={generating} onClick={generate} className="avanti-btn avanti-btn-primary">
            {generating ? 'Checking…' : 'Check requirements →'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {data.summary && (
            <div className="avanti-box border border-forest-deep/20 bg-forest-mist px-5 py-4">
              <p className="text-sm text-foreground m-0 font-serif italic leading-relaxed">{data.summary}</p>
            </div>
          )}

          <div className="flex gap-4 border-b border-border">
            {(['entry', 'health'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`pb-2 text-xs tracking-[0.2em] uppercase transition-colors ${
                  tab === t ? 'text-foreground border-b-2 border-foreground -mb-px' : 'text-muted-foreground'
                }`}
              >
                {t === 'entry' ? 'Visas & documents' : 'Vaccines & meds'}
              </button>
            ))}
          </div>

          {tab === 'entry' && (
            <div className="space-y-6">
              <section>
                <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Visas</p>
                {data.visas.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No visa information available.</p>
                ) : (
                  data.visas.map((v, i) => (
                    <div key={i} className="avanti-box border border-border bg-card px-4 py-3 mb-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium m-0">{v.nationality}</p>
                        <span
                          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-none ${
                            v.visa_required
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-forest-pale text-forest-deep border-forest-deep/30'
                          }`}
                        >
                          {v.visa_required ? (v.visa_type || 'Visa required') : (v.visa_type || 'Visa-free')}
                        </span>
                      </div>
                      {v.how_to_apply && <p className="text-xs text-muted-foreground m-0 mt-1">{v.how_to_apply}</p>}
                      <p className="text-xs m-0 mt-1">
                        {[
                          v.processing_time && `Processing: ${v.processing_time}`,
                          v.cost && `Cost: ${v.cost}`,
                          v.passport_validity && `Passport: ${v.passport_validity}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {v.notes && <p className="text-xs text-muted-foreground m-0 mt-1 italic">{v.notes}</p>}
                    </div>
                  ))
                )}
              </section>

              {data.documents.length > 0 && (
                <section>
                  <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Required documents</p>
                  {data.documents.map((d, i) => (
                    <div key={i} className="avanti-box border border-border bg-card px-4 py-3 mb-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium m-0">{d.name}</p>
                        <span className={`text-[10px] uppercase tracking-wider ${d.required ? 'text-red-700' : 'text-muted-foreground'}`}>
                          {d.required ? 'Required' : 'Recommended'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground m-0 mt-1">{d.details}</p>
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}

          {tab === 'health' && (
            <div className="space-y-6">
              {data.vaccines.length > 0 && (
                <section>
                  <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Vaccines</p>
                  {data.vaccines.map((v, i) => (
                    <div key={i} className="avanti-box border border-border bg-card px-4 py-3 mb-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium m-0">{v.name}</p>
                        <span className={`text-[10px] uppercase tracking-wider ${v.status === 'required' ? 'text-red-700' : 'text-muted-foreground'}`}>
                          {v.status}
                        </span>
                      </div>
                      {v.details && <p className="text-xs text-muted-foreground m-0 mt-1">{v.details}</p>}
                    </div>
                  ))}
                </section>
              )}

              <section>
                <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Your medications</p>
                {data.medications.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No saved medications to check. Add them under Profile → Extra to get personalized guidance.
                  </p>
                ) : (
                  data.medications.map((m, i) => {
                    const badge = MED_STATUS[m.status] || MED_STATUS.unknown
                    return (
                      <div key={i} className="avanti-box border border-border bg-card px-4 py-3 mb-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium m-0">
                            {m.name}
                            {m.who && <span className="text-xs text-muted-foreground font-normal"> · {m.who}</span>}
                          </p>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-none ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        {m.guidance && <p className="text-xs text-muted-foreground m-0 mt-1">{m.guidance}</p>}
                        {m.documents_needed.length > 0 && (
                          <p className="text-xs m-0 mt-1">
                            <span className="uppercase text-[10px] tracking-wider text-muted-foreground">Bring: </span>
                            {m.documents_needed.join(' · ')}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </section>

              {data.bring_from_home.length > 0 && (
                <section>
                  <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Bring from home</p>
                  <div className="avanti-box border border-forest-deep/20 bg-forest-pale px-4 py-3">
                    <ul className="text-sm text-foreground space-y-1 list-disc pl-5 m-0">
                      {data.bring_from_home.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                </section>
              )}
            </div>
          )}

          {data.disclaimer && (
            <p className="text-xs text-muted-foreground italic leading-relaxed">{data.disclaimer}</p>
          )}

          <button type="button" disabled={generating} onClick={generate} className="avanti-btn avanti-btn-ghost w-full">
            {generating ? 'Refreshing…' : '↻ Refresh requirements'}
          </button>
        </div>
      )}
    </SubpageShell>
  )
}
