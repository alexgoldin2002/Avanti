# Booking partners — affiliates, APIs, future premium

How Avanti connects planning steps to bookable inventory and **commission revenue**.

## How you make money

| Channel | Revenue | Setup |
|---------|---------|--------|
| **Affiliate outbound links** | Commission when users book on partner sites | Env vars below (most of monetization today) |
| **Live APIs** (Duffel, LiteAPI, GYG Partner API) | Partner margin on in-app checkout | API keys + partner approval |
| **Google Flights / Hotels** | None — no affiliate program | Use Kayak + Booking.com / Expedia instead |

Every outbound “Book →” link runs through `lib/booking/affiliate.ts`. When an env var is set, the URL is wrapped with your affiliate ID and `pubref={tripId}` for per-trip attribution.

Check what's configured: `GET /api/affiliate/status`

---

## Affiliate env vars (Vercel)

Set these after signing up for each program, then redeploy.

| Variable | Partner | Sign up |
|----------|---------|---------|
| `AFFILIATE_BOOKING_AID` | Booking.com | [Booking.com Affiliate Partner](https://www.booking.com/affiliate-program/v2/index.html) |
| `AFFILIATE_EXPEDIA_CAMREF` | Expedia.com hotels | [Expedia Group partners](https://partners.expediagroup.com/) → Expedia campaign → Partnerize **camref** |
| `VRBO_PARTNERIZE_CAMREF` or `AFFILIATE_VRBO_CAMREF` | VRBO rentals | Same portal → VRBO campaign → **camref** |
| `AFFILIATE_KAYAK_PARTNER_ID` | Kayak flights | [Kayak affiliate program](https://www.kayak.com/affiliates) |
| `AFFILIATE_GETYOURGUIDE_PARTNER_ID` | GetYourGuide tours | [partner.getyourguide.com](https://partner.getyourguide.com/) |
| `GETYOURGUIDE_ACCESS_TOKEN` | GYG Partner API (live search) | Partner Tech after partner signup |
| `AFFILIATE_DEFAULT_PUBREF` | Optional fallback sub-id | e.g. `avanti` |

**Aliases supported:** `BOOKING_AFFILIATE_AID`, `EXPEDIA_PARTNERIZE_CAMREF`, `KAYAK_AFFILIATE_PARTNER_ID`, `GETYOURGUIDE_PARTNER_ID`

### Per-trip tracking

All link builders accept `pubref` (trip id) and `label` (step name: `flights`, `accommodation`, `activities`, `rentals`). Booking.com also gets `label=avanti-{tripId}`.

---

## What each step uses

### Flights (Step 4)

- **Primary:** Kayak (`flightSearchUrl`) — affiliate when `AFFILIATE_KAYAK_PARTNER_ID` set
- **Secondary:** Google Flights (no commission)
- **Future:** Duffel in-app checkout (`DUFFEL_ACCESS_TOKEN`) — API margin, not affiliate

### Hotels (Step 5)

- **Primary:** Booking.com — `aid` affiliate
- **Also:** Expedia.com — Partnerize camref
- **Live rates:** LiteAPI (`LITEAPI_API_KEY`) — margin when booking in-app ships
- **Secondary:** Google Hotels (no commission)

### Vacation rentals (Step 5 — VRBO)

- **Primary:** VRBO via Partnerize camref
- **Future:** Expedia Rapid `supply_source=vrbo` (`EXPEDIA_RAPID_API_KEY` + secret)

### Activities (Step 6)

- **Live search:** GetYourGuide Partner API + affiliate on `tour.url`
- **Fallback:** GYG search with `partner_id` when API token not set

---

## Booking paths (product)

| Path | What | When |
|------|------|------|
| **A — Live API** | Shortlist → vote → book in-app | As partners approve |
| **B — Affiliate bridge** | Tracked outbound links → vault confirmation | **Now — primary revenue** |
| **C — Concierge hybrid (premium)** | App decide + lock; Avanti curated shortlist within ~24h | **Later — premium only** |

Path C: human/agent-heavy, great for high-touch groups. Not building now.

---

## Live API env vars (non-affiliate margin)

| Variable | Step |
|----------|------|
| `DUFFEL_ACCESS_TOKEN` | Flights |
| `LITEAPI_API_KEY` | Hotels |
| `GETYOURGUIDE_ACCESS_TOKEN` | Activities search |
| `GETYOURGUIDE_API_BASE` | Optional sandbox: `https://api.gygtest.net` |
| `EXPEDIA_RAPID_API_KEY` / `EXPEDIA_RAPID_API_SECRET` | VRBO live inventory (future) |

---

## Partnerize link format (VRBO / Expedia)

```
https://prf.hn/click/camref:{CAMREF}/pubref:{tripId}/destination:{raw_partner_url}
```

Do **not** add UTMs to the destination URL.

---

## After booking

All paths converge on **Trip vault** — forward confirmation email, upload, or screenshot → merged itinerary.

---

## Deferred

- **Airbnb** — no API, no affiliate program at scale
- **Path C concierge hybrid** — premium backlog
