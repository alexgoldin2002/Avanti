'use client'

import TripFeatureHub from '../_shared/TripFeatureHub'

export default function BookingsFeature() {
  return (
    <TripFeatureHub
      eyebrow="Confirmations"
      title="Bookings vault"
      description="Forward confirmation emails, upload PDFs, or paste screenshots. All flight codes, hotel details, and QR codes in one place."
      tripPath={id => `/trips/${id}/bookings`}
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      }
    />
  )
}
