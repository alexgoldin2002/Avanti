-- Trip expense splitting (Splitwise-style)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  paid_by_traveler_id uuid references travelers(id) on delete set null,
  expense_date date not null default current_date,
  participant_traveler_ids uuid[] not null default '{}',
  settled boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_trip_id_idx on expenses(trip_id);
create index if not exists expenses_paid_by_idx on expenses(paid_by_traveler_id);

alter table expenses enable row level security;

create policy "Trip members can view expenses"
  on expenses for select
  using (
    exists (
      select 1 from travelers t
      where t.trip_id = expenses.trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from trips tr
      where tr.id = expenses.trip_id
        and tr.organizer_id = auth.uid()
    )
  );

create policy "Trip members can insert expenses"
  on expenses for insert
  with check (
    exists (
      select 1 from travelers t
      where t.trip_id = expenses.trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from trips tr
      where tr.id = expenses.trip_id
        and tr.organizer_id = auth.uid()
    )
  );

create policy "Trip members can update expenses"
  on expenses for update
  using (
    exists (
      select 1 from travelers t
      where t.trip_id = expenses.trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from trips tr
      where tr.id = expenses.trip_id
        and tr.organizer_id = auth.uid()
    )
  );

create policy "Trip members can delete expenses"
  on expenses for delete
  using (
    exists (
      select 1 from travelers t
      where t.trip_id = expenses.trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from trips tr
      where tr.id = expenses.trip_id
        and tr.organizer_id = auth.uid()
    )
  );
