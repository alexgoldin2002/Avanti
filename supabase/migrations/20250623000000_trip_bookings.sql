-- Trip booking vault: confirmations from email forward, file upload, screenshot

create table if not exists public.trip_booking_inbox (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  booked_by_user_id uuid references auth.users(id) on delete set null,
  booked_by_traveler_id uuid references public.travelers(id) on delete set null,
  category text not null default 'other'
    check (category in ('hotel', 'restaurant', 'tour', 'flight', 'activity', 'transport', 'other')),
  display_title text not null,
  vendor_name text,
  confirmation_number text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  party_size int,
  total_amount numeric,
  currency text default 'USD',
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'pending')),
  booker_contact_email text,
  booker_contact_phone text,
  notes text,
  source text not null default 'upload'
    check (source in ('email_forward', 'upload', 'screenshot', 'manual')),
  qr_payload text,
  parsed_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_bookings_trip_id_idx on public.trip_bookings (trip_id);
create index if not exists trip_bookings_starts_at_idx on public.trip_bookings (trip_id, starts_at);

create table if not exists public.trip_booking_files (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.trip_bookings(id) on delete cascade,
  file_type text not null check (file_type in ('pdf', 'image', 'email_raw', 'qr_extracted')),
  storage_path text not null,
  display_name text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists trip_booking_files_booking_id_idx on public.trip_booking_files (booking_id);

alter table public.trip_booking_inbox enable row level security;
alter table public.trip_bookings enable row level security;
alter table public.trip_booking_files enable row level security;

create policy "Trip members trip_booking_inbox"
  on public.trip_booking_inbox for all
  using (public.user_can_access_trip(trip_id));

create policy "Trip members trip_bookings"
  on public.trip_bookings for all
  using (public.user_can_access_trip(trip_id));

create policy "Trip members trip_booking_files"
  on public.trip_booking_files for all
  using (
    exists (
      select 1 from public.trip_bookings b
      where b.id = booking_id and public.user_can_access_trip(b.trip_id)
    )
  );

drop trigger if exists trip_bookings_updated_at on public.trip_bookings;
create trigger trip_bookings_updated_at
  before update on public.trip_bookings
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('trip-bookings', 'trip-bookings', false, 10485760)
on conflict (id) do nothing;
