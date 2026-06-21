# Travelers under your account

## Mental model

**One person accepts the invite and speaks for the group.** You vote once. Your preferences are the group’s preferences.

Extra people (spouse, kids, baby) are added so Avanti knows:

- **Headcount** — group size, rooms, flights
- **Personal details** — passport, birthday, TSA, airline numbers, cards (for planning and booking later)

They are **not** separate voters. A baby doesn’t get a vote. A spouse you’re booking for doesn’t get a second ballot — you already said what you want.

## Accept invite flow

1. **Just me** — only you on the trip
2. **Me + others I’m booking for** — add spouse, kids, etc.; you fill their travel info (or link an existing Avanti profile)

## Account level — Profile → Travelers

**Saved travelers** (Profile → Travelers) — partner, kids, etc. Reused when you accept future invites.

- Enter details manually, **or**
- Link by email if they already have Avanti (pulls passport, DOB, TSA from their profile)

## Trip level

| Column | Purpose |
|--------|---------|
| `role: dependent` | Not a separate decision-maker |
| `can_vote: false` | Never a separate vote |
| `managed_by_user_id` | Who added them and maintains their info |
| `account_companion_id` | Link to saved profile |
| `user_id` (optional) | Set when linked to an existing Avanti account |

## What uses dependent rows

- Traveler count on dashboard / invites
- AI cost estimates per person (passport city, age, etc.)
- Flights / hotels headcount
- **Not** destination voting tallies (one vote per accepting member)
