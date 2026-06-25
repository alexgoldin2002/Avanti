'use client'
import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { deleteTripPermanently, leaveTripAsMember } from '@/lib/trip-lifecycle'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import SubpageShell from '../../../components/SubpageShell'
import AvantiCard from '../../../components/AvantiCard'
import DangerConfirmModal from '../../../components/DangerConfirmModal'
import { savePhaseDurations } from '@/lib/trip-phases/client-api'
import { minutesToSubmissionWindow, submissionWindowToMinutes } from '@/lib/submission-window'
import {
  DEFAULT_BRAINSTORM_MINUTES,
  DEFAULT_ROUND_ONE_MINUTES,
  DEFAULT_ROUND_TWO_MINUTES,
} from '@/lib/trip-phases/types'

const DELETE_STEPS = [
  {
    title: 'Delete this trip?',
    body: (
      <>
        <p className="m-0 mb-3">
          This cannot be undone. This trip will be deleted for everyone. This is not the same as leaving the trip.
        </p>
      </>
    ),
    confirmLabel: 'Continue',
  },
  {
    title: 'Permanently erase all data?',
    body: (
      <>
        <p className="m-0 mb-3">
          All data from this trip will be permanently erased. We are not responsible for anything that you may want to get back — including trip cards or any data that was saved.
        </p>
      </>
    ),
    confirmLabel: 'Delete trip forever',
  },
]

const LEAVE_STEPS = [
  {
    title: 'Leave this trip?',
    body: (
      <>
        <p className="m-0 mb-3">
          Once you leave, everything will be recalculated and changed for the remaining group.
        </p>
        <p className="m-0">
          You cannot rejoin this trip — absolutely no exceptions.
        </p>
      </>
    ),
    confirmLabel: 'Continue',
  },
  {
    title: 'Are you sure?',
    body: (
      <>
        <p className="m-0 mb-3">
          You will be removed from this trip and it will disappear from your dashboard.
        </p>
        <p className="m-0">This cannot be undone.</p>
      </>
    ),
    confirmLabel: 'Leave trip',
  },
]

function handlePhaseTimeInput(
  raw: string,
  setWindow: Dispatch<SetStateAction<{ days: number; hours: number; minutes: number }>>,
  unit: 'days' | 'hours' | 'minutes'
) {
  const digits = raw.replace(/\D/g, '')
  if (digits === '') {
    setWindow(prev => ({ ...prev, [unit]: 0 }))
    return
  }
  const n = Math.min(100, Math.max(1, parseInt(digits, 10)))
  setWindow(prev => ({ ...prev, [unit]: n }))
}

export default function TripSettings() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trip, setTrip] = useState<any>(null)
  const [maxVotes, setMaxVotes] = useState(2)
  const [brainstormWindow, setBrainstormWindow] = useState({ days: 2, hours: 0, minutes: 0 })
  const [roundOneWindow, setRoundOneWindow] = useState({ days: 1, hours: 0, minutes: 0 })
  const [roundTwoWindow, setRoundTwoWindow] = useState({ days: 2, hours: 0, minutes: 0 })
  const [travelerCount, setTravelerCount] = useState(0)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)

  const [deleteStep, setDeleteStep] = useState<number | null>(null)
  const [leaveStep, setLeaveStep] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [saveError, setSaveError] = useState('')
  const skipAutoSaveRef = useRef(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        setIsOrganizer(tripData.organizer_id === user.id)
        const { count } = await supabase.from('travelers').select('*', { count: 'exact', head: true }).eq('trip_id', tripId)
        const tc = count || 0
        setTravelerCount(tc)
        setMaxVotes(tripData.max_votes ?? (tc <= 8 ? 2 : 1))
        setBrainstormWindow(minutesToSubmissionWindow(tripData.brainstorm_duration_minutes ?? DEFAULT_BRAINSTORM_MINUTES))
        setRoundOneWindow(minutesToSubmissionWindow(tripData.round_one_duration_minutes ?? DEFAULT_ROUND_ONE_MINUTES))
        setRoundTwoWindow(minutesToSubmissionWindow(tripData.round_two_duration_minutes ?? DEFAULT_ROUND_TWO_MINUTES))
      }

      const { data: myTraveler } = await supabase
        .from('travelers')
        .select('id, role')
        .eq('trip_id', tripId)
        .eq('user_id', user.id)
        .maybeSingle()
      setIsMember(!!myTraveler && myTraveler.role !== 'organizer')

      setLoading(false)
    }
    load()
  }, [tripId, router])

  useEffect(() => {
    if (loading || skipAutoSaveRef.current) return

    const timer = window.setTimeout(async () => {
      setSaving(true)
      setSaveError('')
      const { error } = await supabase.from('trips').update({ max_votes: maxVotes }).eq('id', tripId)
      if (error) {
        setSaveError(error.message)
        setSaving(false)
        return
      }

      if (isOrganizer && !trip?.voting_round) {
        try {
          await savePhaseDurations(tripId, {
            brainstormDurationMinutes: submissionWindowToMinutes(brainstormWindow),
            roundOneDurationMinutes: submissionWindowToMinutes(roundOneWindow),
            roundTwoDurationMinutes: submissionWindowToMinutes(roundTwoWindow),
          })
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : 'Failed to save phase timers')
          setSaving(false)
          return
        }
      }

      setSaving(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    }, 500)

    return () => window.clearTimeout(timer)
  }, [
    loading,
    tripId,
    maxVotes,
    brainstormWindow,
    roundOneWindow,
    roundTwoWindow,
    isOrganizer,
    trip?.voting_round,
  ])

  useEffect(() => {
    if (!loading) skipAutoSaveRef.current = false
  }, [loading])

  const handleDeleteContinue = async () => {
    if (deleteStep === null) return
    if (deleteStep < DELETE_STEPS.length - 1) {
      setDeleteStep(deleteStep + 1)
      return
    }
    setActionLoading(true)
    setActionError('')
    const { error } = await deleteTripPermanently(tripId)
    setActionLoading(false)
    if (error) {
      setActionError(error)
      return
    }
    router.push('/dashboard')
  }

  const handleLeaveContinue = async () => {
    if (leaveStep === null || !userId) return
    if (leaveStep < LEAVE_STEPS.length - 1) {
      setLeaveStep(leaveStep + 1)
      return
    }
    setActionLoading(true)
    setActionError('')
    const { error } = await leaveTripAsMember(tripId, userId)
    setActionLoading(false)
    if (error) {
      setActionError(error)
      return
    }
    router.push('/dashboard')
  }

  if (loading) return <SuitcaseLoader message="Loading settings" />

  return (
    <>
      <SubpageShell
        backHref={`/trips/${tripId}`}
        eyebrow={trip?.name}
        title="Trip settings"
      >
        {(saving || saved || saveError) && (
          <p className={`text-[10px] uppercase tracking-[0.2em] mb-4 ${saveError ? 'text-red-400' : 'text-muted-foreground'}`}>
            {saveError || (saving ? 'Saving…' : 'Saved ✓')}
          </p>
        )}
        <AvantiCard shade="forest" className="!px-6 !py-6">
          <label className="eyebrow text-cream/60 block mb-2">Max votes per traveler</label>
          <p className="text-xs text-cream/75 mb-5 leading-relaxed">
            How many destination cards each traveler can submit for voting.
            {travelerCount > 0 && ` Auto-set to ${travelerCount <= 8 ? '2' : '1'} based on your group size of ${travelerCount}.`}
          </p>
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxVotes(n)}
                className={`grid h-12 w-12 place-items-center rounded-none border text-base font-serif transition-all duration-200 ${
                  maxVotes === n
                    ? 'border-cream bg-cream/20 text-cream scale-105'
                    : 'border-cream/30 bg-transparent text-cream/70 hover:border-cream/50 hover:bg-cream/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </AvantiCard>

        {isOrganizer && !trip?.voting_round && (
          <AvantiCard shade="forest" className="!px-6 !py-6 mt-6">
            <label className="eyebrow text-cream/60 block mb-2">Phase timers</label>
            <p className="text-xs text-cream/75 mb-5 leading-relaxed">
              Change duration of voting phases for the decision of destination. Hosts can add or end time early on the page itself once it has begun.
            </p>
            {[
              { label: 'Brainstorm & card submission', value: brainstormWindow, set: setBrainstormWindow },
              { label: 'Round 1 voting', value: roundOneWindow, set: setRoundOneWindow },
              { label: 'Round 2 voting', value: roundTwoWindow, set: setRoundTwoWindow },
            ].map(row => (
              <div key={row.label} className="mb-5">
                <p className="text-sm font-serif text-cream mb-2">{row.label}</p>
                <div className="flex gap-3">
                  {(['days', 'hours', 'minutes'] as const).map(unit => (
                    <label key={unit} className="flex-1 text-xs text-cream/60 uppercase tracking-wide">
                      {unit}
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={row.value[unit] === 0 ? '' : String(row.value[unit])}
                        onChange={e => handlePhaseTimeInput(e.target.value, row.set, unit)}
                        className="mt-1 w-full border-b border-cream/35 bg-transparent py-1 text-sm text-cream outline-none font-serif"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </AvantiCard>
        )}

        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}`)}
          className="avanti-btn avanti-btn-ghost w-full mt-6 mb-8"
        >
          Back to trip dashboard
        </button>

        {(isOrganizer || isMember) && (
          <AvantiCard shade="forest" className="!px-6 !py-6 mt-8 !border-red-400/50">
            <p className="eyebrow text-red-300 block mb-2">Danger zone</p>
            <p className="text-xs text-cream/75 mb-6 leading-relaxed">
              {isOrganizer
                ? 'Deleting a trip permanently removes it for every traveler. This cannot be undone.'
                : 'Leaving removes you from this trip permanently. You will not be able to rejoin.'}
            </p>

            {actionError && (
              <p className="text-xs text-red-300 mb-4">{actionError}</p>
            )}

            {isOrganizer && (
              <button
                type="button"
                onClick={() => { setActionError(''); setDeleteStep(0) }}
                className="group flex w-full items-center justify-center gap-2 rounded-none border border-red-400/50 bg-transparent px-4 py-3.5 text-[10px] tracking-[0.2em] uppercase text-red-300 transition-all duration-200 hover:border-red-300 hover:bg-red-400/10"
              >
                <i className="ti ti-trash text-base text-red-300" aria-hidden />
                Delete trip
              </button>
            )}

            {isMember && (
              <button
                type="button"
                onClick={() => { setActionError(''); setLeaveStep(0) }}
                className="w-full rounded-none border border-red-400/50 bg-transparent px-4 py-3.5 text-[10px] tracking-[0.2em] uppercase text-red-300 transition-all duration-200 hover:border-red-300 hover:bg-red-400/10"
              >
                Leave trip
              </button>
            )}
          </AvantiCard>
        )}
      </SubpageShell>

      {deleteStep !== null && (
        <DangerConfirmModal
          steps={DELETE_STEPS}
          stepIndex={deleteStep}
          onCancel={() => { if (!actionLoading) setDeleteStep(null) }}
          onContinue={handleDeleteContinue}
          processing={actionLoading}
        />
      )}

      {leaveStep !== null && (
        <DangerConfirmModal
          steps={LEAVE_STEPS}
          stepIndex={leaveStep}
          onCancel={() => { if (!actionLoading) setLeaveStep(null) }}
          onContinue={handleLeaveContinue}
          processing={actionLoading}
        />
      )}
    </>
  )
}
