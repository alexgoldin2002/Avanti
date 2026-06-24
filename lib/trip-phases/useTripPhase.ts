'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchTripPhases } from '@/lib/trip-phases/client-api'
import { canEditPhase, canViewPhase, getPhaseSnapshot } from '@/lib/trip-phases/state'
import type { PhaseId, PhaseSnapshot, TripPhasesPayload } from '@/lib/trip-phases/types'

export function useTripPhase(tripId: string, phaseId: PhaseId) {
  const [payload, setPayload] = useState<TripPhasesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const data = await fetchTripPhases(tripId)
      setPayload(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timers')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void reload()
    const id = setInterval(() => void reload(), 30_000)
    return () => clearInterval(id)
  }, [reload])

  const phase: PhaseSnapshot | undefined = payload ? getPhaseSnapshot(payload, phaseId) : undefined

  return {
    payload,
    phase,
    loading,
    error,
    reload,
    isOrganizer: payload?.isOrganizer ?? false,
    canEdit: phase ? canEditPhase(phase.access) : false,
    canView: phase ? canViewPhase(phase.access) : false,
    isViewOnly: phase?.access === 'view_only',
    isNotOpened: phase?.access === 'not_opened',
    isExpired: phase?.access === 'expired',
  }
}
