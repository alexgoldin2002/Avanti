import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'trip-bookings'

export async function uploadBookingFile(
  admin: SupabaseClient,
  tripId: string,
  bookingId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${tripId}/${bookingId}/${Date.now()}-${safeName}`

  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function getSignedBookingFileUrl(
  admin: SupabaseClient,
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) return null
  return data.signedUrl
}
