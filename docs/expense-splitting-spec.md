# Expense splitting

Splitwise-style bill splitting per trip. Persists to Supabase `expenses` table.

## Migration

Run `supabase/migrations/20250625000000_expenses.sql` in Supabase SQL editor.

## API

- `GET /api/expenses/[tripId]` — list expenses
- `POST /api/expenses/[tripId]` — create one or `{ expenses: [...] }` batch (receipt scan)
- `PATCH /api/expenses/[tripId]` — `{ id, settled }`
- `DELETE /api/expenses/[tripId]` — `{ id }`

## UI

`/features/expense-splitting/[tripId]` — manual entry, receipt scan via `/api/scan-receipt`, balances, Venmo settle-up links.
