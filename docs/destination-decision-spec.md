# Destination Decision — Product & Engineering Spec

**Status:** Source of truth for v1 (public-ready).  
**Last updated:** 2026-06-04

This document defines the **Choose destination** experience: user-facing steps, data model, APIs, and build order. Each user step is built **once**, production-ready — no placeholder vote flows.

---

## Product decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who runs Brainstorm Q&A | Organizer first; members may add their own Step 2 answers before voting | Keeps momentum; group still gets personalized costs |
| Member constraints before vote | Required lightweight block if Step 2 not done: departure city, budget ceiling, direct-only, date flexibility | Analysis needs per-person inputs |
| Suggestions per member | **1** during submission window | Keeps option set manageable |
| AI seed options | 4 Brainstorm cards × **3 tiers** (Budget / Mid / Luxury) = up to 12 votable rows | Fixes “Tokyo cheap ≠ Tokyo luxury” |
| Member suggestions | AI assigns 3 tier variants on submit | Same vote UX as AI options |
| Submission window default | **48 hours** (organizer: 24h / 48h / 72h / 1 week) | Enough time for async groups |
| Analysis buffer | **45 minutes** minimum after submission closes; enrichment also runs **during** submission | Fast groups aren’t blocked; large groups see progress |
| Meta-vote timing | First screen when voting phase opens; **24h** to complete (same window as voting starts) | One tap, sets group ranking lens |
| Voting window default | **72 hours** | Matches async trip planning |
| Confirm window | **48 hours** after voting closes | Soft commit before lock |
| Budget strictness default | **Soft target** (show overage, don’t hide) | Organizer can set Hard cap or Open |
| Winner rule | Highest composite score among options with **≥50% approve** among voters; tie → organizer picks top 2 | Balance desire vs willingness |
| Feasibility gate | Winner must have **≥50% members** “Works for you: Yes” at recommended scenario | Avoid picking a dream nobody can do |
| After lock | Write `trips.destination`, `locked_tier`, date window → unlock **Itinerary & flights** | Real prices confirmed at booking |
| Price drift escape hatch | Step 3: if real flights > estimate by **>15%**, prompt reopen or adjust tier/dates | Post-lock safety valve |

---

## Where this lives in the app

### Planning steps (dashboard)

| # | Key | Title | Notes |
|---|-----|-------|-------|
| 1 | invite | Invite guests | Existing |
| 2 | brainstorm | Brainstorm | Existing Step 2 Q&A + AI cards |
| 3 | **choose** | **Choose destination** | **This spec** — one route, many internal states |
| 4 | itinerary | Itinerary & flights | Locked until destination locked |
| 5 | stay | Accommodation | Existing |
| 6 | activities | Activities | Existing |
| 7 | dining | Dining | Existing |

**Route:** `/trips/[tripId]/choose` — single entry; UI adapts to `destination_decisions.status`.

**Retire after ship:** `/trips/[tripId]/vote`, `/trips/[tripId]/vote/[voteId]`, simple destination checkbox vote on `/destinations`. Keep `group_votes` read-only for legacy trips.

---

## User journey (seven states)

All states are **one product**. Users never see “beta” or “coming soon” for a later version of the same step.

```
Brainstorm done
      ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. SUGGESTIONS OPEN                                         │
│    Organizer started decision · members add up to 1 idea    │
│    · see AI cards as read-only preview                      │
│    · countdown to submission deadline                       │
└─────────────────────────────────────────────────────────────┘
      ↓ submission closes (or organizer closes early)
┌─────────────────────────────────────────────────────────────┐
│ 2. ANALYZING                                                │
│    “Avanti is pricing your options…”                        │
│    · progress: N/M options ready                            │
│    · min 45 min; may finish sooner                            │
└─────────────────────────────────────────────────────────────┘
      ↓ analysis complete
┌─────────────────────────────────────────────────────────────┐
│ 3. SET GROUP PRIORITY (meta-vote)                           │
│    Budget first · Experience first · Balance (one tap)      │
│    · required once per member before rating destinations    │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. VOTE                                                     │
│    Tier cards · toggles · desire · approve · compare        │
│    · 72h default countdown                                  │
└─────────────────────────────────────────────────────────────┘
      ↓ voting closes
┌─────────────────────────────────────────────────────────────┐
│ 5. RESULTS                                                  │
│    Ranked list · group fit · approve counts · tradeoffs     │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. CONFIRM                                                  │
│    “I’m in at ~$X” / “Can’t do this”                        │
│    · organizer sees names; group sees counts only           │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. LOCK                                                     │
│    Organizer locks destination + tier + dates               │
│    → Itinerary & flights unlocks                            │
└─────────────────────────────────────────────────────────────┘
```

### Screen requirements per state (build complete on first ship)

| State | Must ship with |
|-------|----------------|
| Suggestions open | Deadline picker (organizer), add-suggestion form, cap enforcement, AI card gallery, empty/closed states, email/nudge hook |
| Analyzing | Progress bar, option count, “what happens next”, no dead-end |
| Set group priority | 3 cards with plain-language copy, persisted per member, skip blocked until done |
| Vote | Tier cards, flight/date toggles (instant from cache), desire 1–5, approve toggle, Works for you badge, group fit X/Y, compare-two, private max (organizer-only) |
| Results | Transparent ranking line, approve %, feasibility summary |
| Confirm | Stated max cost, organizer dashboard for holdouts |
| Lock | Confirm dialog, write trip fields, redirect to itinerary |

---

## Vote UI detail (state 4)

### Votable unit
**`destination_option`** = one destination **× one tier** (e.g. “Lisbon · Mid”).

### Per card — group sees
- Destination name, country, tier label
- Group avg est. all-in
- Recommended dates (from trip range)
- Group fit: “7/8 members — Yes at this tier”
- One-line tradeoff (from Brainstorm card or analysis)

### Per card — member sees (personalized)
- **Your est.** (updates instantly when toggles change)
- **Works for you:** Yes / Tight / No
- **Toggles** (from precomputed `scenarios` cache):
  - Flights: Direct · 1-stop OK · Cheapest
  - Dates: Group best · Leave Fri · Leave Mon

### Per card — member inputs
- **Desire** (1–5 stars)
- **Approve:** “I’d go if the group picks this” (yes/no)
- **Private max** (checkbox): “This is my ceiling — organizer only”

### Compare mode
Side-by-side any two options: your cost, desire, approve, tradeoff, feasibility.

### Meta-vote effect on sort order
| Mode | Default sort weight |
|------|---------------------|
| Budget first | Lowest group avg est. ↑, then desire |
| Experience first | Highest avg desire ↑, then approve % |
| Balance | `0.5 × normalized_desire + 0.5 × normalized_inverse_cost` |

Ranking line example: *“#2 for your group — Balance + strong approve rate at Mid tier.”*

---

## Winner algorithm

```
For each destination_option:
  desire_avg     = mean(desire_score) among voters who rated
  approve_rate   = approve_count / voters_who_submitted
  feasibility_ok = count(works_for_you = yes) / total_members
  composite      = f(meta_vote_mode, desire_avg, approve_rate, inverse_cost)

Eligible winners = options where approve_rate >= 0.5 AND feasibility_ok >= 0.5

Winner = max(composite) among eligible
If none eligible → organizer picks manually with warning banner
If tie → organizer picks from tied set (max 2 shown)
```

---

## Data model

### `destination_decisions` (one row per trip)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| trip_id | uuid FK unique | |
| status | text | see enum below |
| submission_deadline | timestamptz | |
| analysis_started_at | timestamptz | |
| analysis_completed_at | timestamptz | |
| voting_deadline | timestamptz | |
| confirm_deadline | timestamptz | |
| budget_strictness | text | `hard` \| `soft` \| `open` |
| group_priority_mode | text | `budget` \| `experience` \| `balance` — aggregate after meta-votes |
| locked_option_id | uuid FK | |
| winner_option_id | uuid FK | set at vote close |
| settings | jsonb | organizer overrides |
| created_at, updated_at | timestamptz | |

**Status enum:**  
`suggestions_open` → `analyzing` → `meta_vote` → `voting` → `results` → `confirming` → `locked`  
Also: `draft` (not started), `cancelled`

### `destination_options`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| decision_id | uuid FK | |
| trip_id | uuid FK | denormalized for RLS |
| name | text | e.g. “Lisbon, Portugal” |
| country | text | |
| tier | text | `budget` \| `mid` \| `luxury` |
| source | text | `ai_card` \| `member_suggestion` |
| source_traveler_id | uuid | nullable |
| card_snapshot | jsonb | Brainstorm fields |
| group_summary | jsonb | avg costs, recommended scenario, tradeoff |
| sort_order | int | |
| created_at | timestamptz | |

### `destination_option_analysis` (per member per option)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| option_id | uuid FK | |
| traveler_id | uuid FK | |
| scenarios | jsonb | `{ direct, one_stop, cheapest } × { best, fri, mon }` → `{ cost, works: yes\|tight\|no }` |
| flags | jsonb | visa, long_haul, etc. |
| computed_at | timestamptz | |

### `destination_option_votes`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| option_id | uuid FK | |
| user_id | uuid FK | |
| desire_score | int 1–5 | |
| approved | boolean | |
| toggles | jsonb | `{ flight, dates }` |
| private_max | boolean | organizer-only visibility |
| created_at, updated_at | timestamptz | |
| unique(option_id, user_id) | | |

### `destination_meta_votes`

| Column | Type | Notes |
|--------|------|-------|
| decision_id | uuid FK | |
| user_id | uuid FK | |
| priority | text | `budget` \| `experience` \| `balance` |
| unique(decision_id, user_id) | | |

### `destination_confirmations`

| Column | Type | Notes |
|--------|------|-------|
| decision_id | uuid FK | |
| user_id | uuid FK | |
| confirmed | boolean | |
| stated_max_cost | numeric | nullable |
| unique(decision_id, user_id) | | |

### Trip columns (on lock)

```sql
alter table trips add column if not exists locked_tier text;
alter table trips add column if not exists locked_date_start date;
alter table trips add column if not exists locked_date_end date;
alter table trips add column if not exists destination_decision_id uuid;
```

---

## AI analysis

### When it runs
1. **On Brainstorm complete** — seed 12 options (4×3 tiers), queue analysis immediately (background).
2. **On member suggestion** — create 3 tier options, queue analysis for those.
3. **On submission close** — finalize pass for any stale/missing rows.

### Input per analysis call
- Trip dates, type, group size
- Option: name, tier, card snapshot
- Per traveler: departure city, budget ceiling, step2 answers, direct-only flags

### Output (structured JSON)
Stored in `destination_option_analysis.scenarios` — no free-text-only storage.

### Prompt location
Extend patterns from `docs/step2-generation-prompt.md` → new `docs/destination-analysis-prompt.md` (to be written at implementation).

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/destinations/decision/start` | Organizer starts decision (deadlines, strictness) |
| POST | `/api/destinations/decision/suggest` | Member adds suggestion |
| POST | `/api/destinations/decision/close-submissions` | Organizer early close |
| POST | `/api/destinations/analyze` | Trigger/batch analysis (internal + cron) |
| GET | `/api/destinations/decision/[tripId]` | Full decision payload for UI |
| POST | `/api/destinations/decision/meta-vote` | Member priority |
| POST | `/api/destinations/decision/vote` | Desire + approve + toggles |
| POST | `/api/destinations/decision/confirm` | Soft commit |
| POST | `/api/destinations/decision/lock` | Organizer lock → trip update |

### Cron / edge
- Poll `destination_decisions` where `status = analyzing` and deadlines passed → advance state
- Poll `submission_deadline` passed → set `analyzing`, kick analyze job

---

## Engineering build order

Build in this sequence. **Do not expose `/choose` to users until step 8.**

1. ✅ Spec (this doc)
2. Database migration + RLS policies
3. Types + status machine (`lib/destination-decision/`)
4. Analysis service + prompt doc
5. API routes (start → analyze → vote → lock)
6. Cron/state transitions
7. `/choose` UI — all 7 states in one page component tree
8. Brainstorm handoff — “Start group decision” button
9. Dashboard step 3 + retire old vote routes
10. Step 3 escape hatch hook (can ship same release or immediately after)

---

## Brainstorm → Choose handoff

When organizer clicks **Start group decision** on Step 2:
1. Create `destination_decisions` row (`suggestions_open`)
2. Expand `trip_destinations.cards` into `destination_options` (4 × 3 tiers)
3. Queue analysis for all options
4. Navigate to `/trips/[tripId]/choose`

Members receive nudge: “Add your destination idea — 48 hours left.”

---

## Notifications (v1)

| Event | Channel |
|-------|---------|
| Decision started | Email + in-app |
| 24h before submission close | Email |
| Voting open | Email |
| 24h before voting close | Email |
| Results ready | Email |
| Confirm reminder | Email |
| Destination locked | Email |

Use existing nudge/SMS infrastructure where present.

---

## Open questions (none blocking v1)

- SMS copy for decision events — mirror email
- Multi-round voting — **out of v1**; single round with approve gate

---

## Definition of done (v1 public)

- [ ] One trip can run Brainstorm → Choose (all states) → Lock → Itinerary
- [ ] No user-facing link to old `/vote` flows
- [ ] Analysis completes for 8 members × 12 options within 45 min p95
- [ ] Toggle updates feel instant (<100ms from cache)
- [ ] Organizer can complete lock with 1 holdout (acknowledged)
- [ ] Mobile-responsive vote UI
