import crypto from 'crypto'

export function generateInboxToken(): string {
  return crypto.randomBytes(8).toString('hex')
}

export function bookingsInboxAddress(token: string): string {
  const domain = process.env.BOOKINGS_INBOUND_DOMAIN
    || process.env.NEXT_PUBLIC_BOOKINGS_EMAIL_DOMAIN
    || 'confirmations.avanti.app'
  return `bookings+${token}@${domain}`
}

/** Parse token from To address like bookings+abc123@domain.com */
export function tokenFromInboxAddress(to: string): string | null {
  const match = to.match(/bookings\+([a-z0-9]+)@/i)
  return match?.[1]?.toLowerCase() ?? null
}
