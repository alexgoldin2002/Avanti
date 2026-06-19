# Booking vault — spec

Three intake paths → one `trip_bookings` table → Bookings page + itinerary links.

## Intake

| Method | UX | API |
|--------|-----|-----|
| Forward email | `bookings+{token}@confirmations.avanti.app` | `POST /api/inbound/booking-email` |
| File upload | Drop zone / choose file | `POST /api/bookings/parse` → `POST /api/bookings/[tripId]` |
| Screenshot | Paste ⌘V or drop PNG | Same as upload (`source: screenshot`) |

## Env vars

- `BOOKINGS_INBOUND_DOMAIN` or `NEXT_PUBLIC_BOOKINGS_EMAIL_DOMAIN` — inbox domain
- `INBOUND_EMAIL_SECRET` — webhook auth (Postmark/etc.)
- `SUPABASE_SERVICE_ROLE_KEY` — storage uploads
- `TWILIO_*` — optional SMS on new booking

## Postmark setup

1. Inbound domain → webhook URL: `https://avanti-kappa.vercel.app/api/inbound/booking-email`
2. Header: `x-inbound-secret: {INBOUND_EMAIL_SECRET}`

## Migration

Run `supabase/migrations/20250623000000_trip_bookings.sql` in Supabase SQL editor.
