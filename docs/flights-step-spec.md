# Step 4 — Flights

**Status:** Source of truth for v1.  
**Route:** `/trips/[tripId]/flights`  
**Prerequisite:** Step 3 complete — destination + tier locked.

---

## Product flow

| Phase | Who | What |
|-------|-----|------|
| **Setup** | Organizer | Flight coordination: fly together · meet at destination · mix |
| **Preferences** | All members | Direct vs stops, airlines, status, cards, cost vs time, group routing (mix) |
| **Analyze** | Avanti AI | Scenarios with real-ish pricing (Duffel later; AI estimates v1) |
| **Review** | Group | Compare scenarios: timing, ground transport, group arrival, cost vs vote |
| **Lock** | Organizer | Confirm flights → **dates fixed** → unlock Step 5 (Hotels) |

---

## Organizer: coordination mode

Before search opens:

- **Together** — AI finds group routing (shared hub if needed); show cost delta vs everyone booking solo.
- **Independent** — each member books their own path; surface arrival spread and optional meetups.
- **Mix** — per member: wants coordinated routing or solo.

**>9 travelers:** show note that airlines often require calling for group fares — members handle that themselves.

---

## Member preferences (per trip)

Pulled from profile where possible (`benefits_profile`, departure city, passport on file):

| Input | Notes |
|-------|-------|
| Direct vs nonstop vs stops OK vs cheapest | Maps to analysis scenarios |
| Preferred airlines | From benefits profile + trip override |
| Airlines to avoid | Optional |
| Status / loyalty tier | From `benefits_profile.airlines` |
| Credit cards | From profile → bag perks, lounge, credits |
| Cost vs time | `cost` · `balance` · `time` |
| Wants group routing | Mix mode only |

---

## Analysis dimensions (every scenario)

For **each member** and **each scenario**:

1. **Routing** — nonstop vs 1-stop vs multi; airline; total duration; segment breakdown (“full send” vs broken up).
2. **Pricing** — estimated USD; bags included via status/cards; perks applied.
3. **Outbound timing** — depart/arrive local; arrival vs typical check-in (3pm); full day vs lose day vs red-eye.
4. **Return timing** — same framing; early wake vs full last day.
5. **Ground transport** — if destination city ≠ airport area: train / taxi / rideshare / bus with time + cost compare.
6. **Group sync** — when each member arrives; spread in hours; meet at hub / before trip / at destination.
7. **Cost vs time** — label and score for the scenario.
8. **Cheapest dates** — best leave/return window inside organizer date range; savings vs peak.
9. **Cheapest order** — for “together” mode: optimal hub order or stagger (e.g. connect through ORD).

**Group together:** explicit **solo vs group cost delta** per person and total.

---

## Price drift (vs Step 3 vote)

If live/AI flight total exceeds Round 2 estimate by **>15%**:

- Flag organizer prominently.
- Offer: adjust dates/tier, rerun analysis, or reopen destination decision.

---

## Lock semantics

On **Lock flights**:

- `trips.flights_locked = true`
- `trips.locked_date_start` / `locked_date_end` updated from chosen scenario
- `trips.dates_locked = true`
- Unlock **Step 5 — Accommodation** (hotels gated on flights locked, not just destination)

---

## Data model

See `supabase/migrations/20250627000000_trip_flights.sql`.

---

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/flights/[tripId]` | Session, prefs, analysis, trip context |
| POST | `/api/flights/[tripId]/coordination` | Organizer sets mode (+ mix defaults) |
| POST | `/api/flights/[tripId]/preferences` | Member saves prefs |
| POST | `/api/flights/[tripId]/analyze` | Run AI scenario generation |
| POST | `/api/flights/[tripId]/lock` | Organizer locks scenario + dates |

---

## v1 vs later

| v1 (now) | Later |
|----------|-------|
| AI flight estimates + structured compare UI | Duffel live search + affiliate deep links |
| Passport/TSA shown as “on file” from profile | Pre-fill checkout |
| Member prefs + group analysis | Real-time fare refresh |

---

## Dashboard

Step 4 title: **Flights** → `/trips/[tripId]/flights`  
Step 5 **Accommodation** locked until `flights_locked`.
