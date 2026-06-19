'use client'

import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'

export default function ActivitiesPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()

  return (
    <SubpageShell backHref={`/trips/${tripId}/itinerary`} backLabel="Itinerary" title="Activities" subtitle="Things to do">
      <div className="avanti-box border border-border bg-forest-mist px-6 py-12 text-center">
        <p className="font-serif text-xl mb-2">Coming in the next release</p>
        <p className="text-sm text-muted-foreground mb-6 m-0">
          Group activities and bookings will live here, tied to your locked destination and dates.
        </p>
        <button type="button" onClick={() => router.push(`/trips/${tripId}/itinerary`)} className="avanti-btn avanti-btn-ghost">
          ← Back to itinerary
        </button>
      </div>
    </SubpageShell>
  )
}
