alter table public.account_companions
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null;

comment on column public.account_companions.linked_user_id is
  'When set, passport and benefits are pulled from this user''s Avanti profile instead of re-entering.';
