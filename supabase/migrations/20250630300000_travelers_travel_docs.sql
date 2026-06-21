-- Optional denormalized travel fields on trip travelers (passport/TSA live on account_companions too)

alter table public.travelers add column if not exists passport_number text;
alter table public.travelers add column if not exists tsa_known_traveler text;
alter table public.travelers add column if not exists departure_city text;
alter table public.travelers add column if not exists date_of_birth date;
