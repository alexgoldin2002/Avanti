'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../../components/SubpageShell'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import { fetchTripBookings, CATEGORY_LABELS } from '@/lib/bookings/client-api'

export default function BookingDetailPage() {
  const { tripId, bookingId } = useParams() as { tripId: string; bookingId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<any>(null)

  useEffect(() => {
    fetchTripBookings(tripId)
      .then(data => {
        const b = data.bookings.find(x => x.id === bookingId)
        setBooking(b || null)
      })
      .finally(() => setLoading(false))
  }, [tripId, bookingId])

  if (loading) return <SuitcaseLoader message="Loading confirmation" />
  if (!booking) {
    return (
      <SubpageShell backHref={`/trips/${tripId}/bookings`} title="Not found">
        <p className="text-muted-foreground">This booking could not be found.</p>
      </SubpageShell>
    )
  }

  const copyConf = () => {
    if (booking.confirmation_number) {
      navigator.clipboard.writeText(booking.confirmation_number)
    }
  }

  const imageFile = (booking.files as Array<{ url: string | null; file_type: string }>)?.find(
    f => f.file_type === 'image' || f.file_type === 'pdf'
  )

  return (
    <SubpageShell
      backHref={`/trips/${tripId}/bookings`}
      backLabel="Bookings"
      title={booking.display_title}
      subtitle={CATEGORY_LABELS[booking.category] || booking.category}
      maxWidth="max-w-2xl"
    >
      <div className="avanti-box border border-border bg-card p-5 mb-6 space-y-3">
        {booking.confirmation_number && (
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Confirmation</p>
              <p className="font-mono text-lg text-forest-deep">{booking.confirmation_number}</p>
            </div>
            <button type="button" onClick={copyConf} className="text-[10px] uppercase tracking-wider text-forest-deep hover:underline">
              Copy
            </button>
          </div>
        )}
        {booking.starts_at && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">When</p>
            <p className="text-sm">{new Date(booking.starts_at).toLocaleString()}</p>
          </div>
        )}
        {booking.location && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Where</p>
            <p className="text-sm">{booking.location}</p>
          </div>
        )}
        {booking.booker && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Booked by</p>
            <p className="text-sm">{booking.booker.name}</p>
            {booking.booker.email && <p className="text-xs text-muted-foreground">{booking.booker.email}</p>}
            {booking.booker.phone && <p className="text-xs text-muted-foreground">{booking.booker.phone}</p>}
          </div>
        )}
        {booking.notes && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</p>
            <p className="text-sm text-muted-foreground">{booking.notes}</p>
          </div>
        )}
      </div>

      {booking.qr_payload && (
        <div className="avanti-box border border-border bg-forest-mist p-5 mb-6 text-center">
          <p className="eyebrow text-muted-foreground mb-2">QR / scan code</p>
          <p className="font-mono text-sm break-all">{booking.qr_payload}</p>
          <p className="text-xs text-muted-foreground mt-2">Show this at check-in if a visual QR isn&apos;t attached.</p>
        </div>
      )}

      {imageFile?.url && (
        <div className="avanti-box border border-border bg-card overflow-hidden mb-6">
          <p className="eyebrow text-muted-foreground px-5 pt-4">Attachment</p>
          {imageFile.file_type === 'pdf' ? (
            <iframe src={imageFile.url} title="Confirmation PDF" className="w-full h-[480px] border-0" />
          ) : (
            <img src={imageFile.url} alt="Confirmation" className="w-full h-auto" />
          )}
        </div>
      )}

      <button type="button" onClick={() => router.push(`/trips/${tripId}/itinerary`)} className="avanti-btn avanti-btn-primary w-full">
        See on itinerary →
      </button>
    </SubpageShell>
  )
}
