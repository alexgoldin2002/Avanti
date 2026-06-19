import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from './types'
import { uploadBookingFile } from './storage'

import { generateInboxToken, bookingsInboxAddress } from './inbox'

export async function ensureTripInbox(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ token: string; address: string }> {

  const { data: existing } = await supabase
    .from('trip_booking_inbox')
    .select('token')
    .eq('trip_id', tripId)
    .maybeSingle()

  if (existing?.token) {
    return { token: existing.token, address: bookingsInboxAddress(existing.token) }
  }

  const token = generateInboxToken()
  const { error } = await supabase.from('trip_booking_inbox').insert({ trip_id: tripId, token })
  if (error) throw new Error(error.message)

  return { token, address: bookingsInboxAddress(token) }
}

export async function createTripBooking(
  admin: SupabaseClient,
  input: {
    tripId: string
    userId: string | null
    travelerId: string | null
    parsed: ParsedBooking
    source: 'email_forward' | 'upload' | 'screenshot' | 'manual'
    file?: { buffer: Buffer; fileName: string; mimeType: string }
    rawParsed?: Record<string, unknown>
  }
): Promise<{ bookingId: string; created: boolean }> {
  if (input.parsed.confirmation_number && input.parsed.vendor_name) {
    const { data: dup } = await admin
      .from('trip_bookings')
      .select('id')
      .eq('trip_id', input.tripId)
      .eq('confirmation_number', input.parsed.confirmation_number)
      .ilike('vendor_name', input.parsed.vendor_name)
      .maybeSingle()

    if (dup?.id) {
      await admin.from('trip_bookings').update({
        display_title: input.parsed.display_title,
        starts_at: input.parsed.starts_at,
        ends_at: input.parsed.ends_at,
        parsed_json: input.rawParsed || input.parsed,
        updated_at: new Date().toISOString(),
      }).eq('id', dup.id)

      if (input.file) {
        const path = await uploadBookingFile(
          admin,
          input.tripId,
          dup.id,
          input.file.fileName,
          input.file.buffer,
          input.file.mimeType
        )
        await admin.from('trip_booking_files').insert({
          booking_id: dup.id,
          file_type: input.file.mimeType === 'application/pdf' ? 'pdf' : 'image',
          storage_path: path,
          display_name: input.file.fileName,
          mime_type: input.file.mimeType,
        })
      }
      return { bookingId: dup.id, created: false }
    }
  }

  const { data: booking, error } = await admin
    .from('trip_bookings')
    .insert({
      trip_id: input.tripId,
      booked_by_user_id: input.userId,
      booked_by_traveler_id: input.travelerId,
      category: input.parsed.category,
      display_title: input.parsed.display_title,
      vendor_name: input.parsed.vendor_name,
      confirmation_number: input.parsed.confirmation_number,
      starts_at: input.parsed.starts_at,
      ends_at: input.parsed.ends_at,
      location: input.parsed.location,
      party_size: input.parsed.party_size,
      total_amount: input.parsed.total_amount,
      currency: input.parsed.currency,
      booker_contact_email: input.parsed.booker_contact_email,
      booker_contact_phone: input.parsed.booker_contact_phone,
      qr_payload: input.parsed.qr_payload,
      notes: input.parsed.notes,
      source: input.source,
      parsed_json: input.rawParsed || input.parsed,
    })
    .select('id')
    .single()

  if (error || !booking) throw new Error(error?.message || 'Failed to create booking')

  if (input.file) {
    const path = await uploadBookingFile(
      admin,
      input.tripId,
      booking.id,
      input.file.fileName,
      input.file.buffer,
      input.file.mimeType
    )
    await admin.from('trip_booking_files').insert({
      booking_id: booking.id,
      file_type: input.file.mimeType === 'application/pdf' ? 'pdf' : 'image',
      storage_path: path,
      display_name: input.file.fileName,
      mime_type: input.file.mimeType,
    })
  }

  return { bookingId: booking.id, created: true }
}

export async function resolveTravelerForUser(
  supabase: SupabaseClient,
  tripId: string,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle()
  if (!profile?.email) return null
  const { data: traveler } = await supabase
    .from('travelers')
    .select('id')
    .eq('trip_id', tripId)
    .ilike('email', profile.email)
    .maybeSingle()
  return traveler?.id ?? null
}

export async function resolveTripFromInboxToken(
  admin: SupabaseClient,
  token: string
): Promise<string | null> {
  const { data } = await admin
    .from('trip_booking_inbox')
    .select('trip_id')
    .eq('token', token.toLowerCase())
    .maybeSingle()
  return data?.trip_id ?? null
}

export async function resolveUserFromEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data } = await admin
    .from('user_profiles')
    .select('user_id')
    .ilike('email', email.trim())
    .maybeSingle()
  return data?.user_id ?? null
}
