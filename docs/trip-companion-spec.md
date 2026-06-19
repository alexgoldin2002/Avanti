# Trip companion — spec

Game-time features: saved places, destination essentials, local apps, daily briefings.

## Saved places (`/trips/[tripId]/saves`)

Paste TikTok/Instagram/Pinterest/article links or drop screenshots. AI identifies the place and suggests the best day/time on the itinerary. Tap **Add to itinerary** to pin it on Game time for the whole group.

**API:** `POST /api/inspiration/[tripId]/add-to-itinerary`

**Migration:** `supabase/migrations/20250624000000_trip_inspirations.sql`

## Destination essentials (`/trips/[tripId]/essentials`)

- Emergency / police / ambulance numbers
- Nearest hospitals to hotel
- Embassy for each traveler nationality (from `user_profiles.country_of_residence`)
- Local apps tab: rideshare, transit, food delivery, taxi numbers

Stored in `trips.options.companion`.

## Daily briefings (`/trips/[tripId]/briefings`)

- **Evening:** tomorrow preview, wake time, pack list
- **Morning:** leave-by times, return-to-hotel estimates

Cron: `/api/trip-companion/briefings/cron` (hourly; sends SMS when `TWILIO_*` configured).

## Game time tab

Trip dashboard shows full day-by-day itinerary with flight/hotel confirmations inline.
