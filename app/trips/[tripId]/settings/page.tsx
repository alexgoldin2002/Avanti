'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { deleteTripPermanently, leaveTripAsMember } from '@/lib/trip-lifecycle'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import SubpageShell from '../../../components/SubpageShell'
import AvantiCard from '../../../components/AvantiCard'
import DangerConfirmModal from '../../../components/DangerConfirmModal'

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

export default function TripSettings() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trip, setTrip] = useState<any>(null)
  const [maxVotes, setMaxVotes] = useState(2)
  const [travelerCount, setTravelerCount] = useState(0)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)

  const [deleteStep, setDeleteStep] = useState<number | null>(null)
  const [leaveStep, setLeaveStep] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

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

  const save = async () => {
    setSaving(true)
    await supabase.from('trips').update({
      max_votes: maxVotes,
    }).eq('id', tripId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
        <AvantiCard shade="ivory" className="!px-6 !py-6">
          <label className="eyebrow text-muted-foreground block mb-2">Max votes per traveler</label>
          <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
            How many destination cards each traveler can vote for.
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
                    ? 'border-forest-deep bg-forest-pale text-forest-deep scale-105'
                    : 'border-border bg-card text-muted-foreground hover:border-forest-deep/40 hover:bg-forest-mist'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </AvantiCard>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="avanti-btn-primary w-full disabled:opacity-50"
        >
          {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save settings →'}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}`)}
          className="avanti-btn avanti-btn-ghost w-full mt-3 mb-8"
        >
          Back to trip dashboard
        </button>

        {(isOrganizer || isMember) && (
          <AvantiCard shade="ivory" className="!px-6 !py-6 mt-8 !border-destructive/25">
            <p className="eyebrow text-destructive block mb-2">Danger zone</p>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              {isOrganizer
                ? 'Deleting a trip permanently removes it for every traveler. This cannot be undone.'
                : 'Leaving removes you from this trip permanently. You will not be able to rejoin.'}
            </p>

            {actionError && (
              <p className="text-xs text-destructive mb-4">{actionError}</p>
            )}

            {isOrganizer && (
              <button
                type="button"
                onClick={() => { setActionError(''); setDeleteStep(0) }}
                className="group flex w-full items-center justify-center gap-2 rounded-none border border-destructive/40 bg-transparent px-4 py-3.5 text-[10px] tracking-[0.2em] uppercase text-destructive transition-all duration-200 hover:border-destructive hover:bg-destructive/5"
              >
                <i className="ti ti-trash text-base text-destructive" aria-hidden />
                Delete trip
              </button>
            )}

            {isMember && (
              <button
                type="button"
                onClick={() => { setActionError(''); setLeaveStep(0) }}
                className="w-full rounded-none border border-destructive/40 bg-transparent px-4 py-3.5 text-[10px] tracking-[0.2em] uppercase text-destructive transition-all duration-200 hover:border-destructive hover:bg-destructive/5"
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
