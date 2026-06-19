# Expense splitting

Splitwise-style bill splitting per trip. Persists to Supabase `expenses` table.

## Migration

Run `supabase/migrations/20250626000000_expenses_schema_fix.sql` in Supabase SQL editor.

If you already have an old `expenses` table from a prior stub, this migration drops it and recreates the correct schema.

## API

- `GET /api/expenses/[tripId]` — list expenses
- `POST /api/expenses/[tripId]` — create one or `{ expenses: [...] }` batch (receipt scan)
- `PATCH /api/expenses/[tripId]` — `{ id, settled }`
- `DELETE /api/expenses/[tripId]` — `{ id }`

## UI

`/features/expense-splitting/[tripId]` — manual entry, receipt scan via `/api/scan-receipt`, balances, Venmo settle-up links.
