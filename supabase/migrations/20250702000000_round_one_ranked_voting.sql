-- Round 1: replace yes/no votes with ranked ordering (1 = top choice)
-- Safe to re-run. Skip vote migration if table was created with rank already.

alter table public.round_one_votes add column if not exists rank integer check (rank >= 1);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'round_one_votes'
      and column_name = 'vote'
  ) then
    update public.round_one_votes set rank = 1 where rank is null and vote is true;
    update public.round_one_votes set rank = 999 where rank is null and vote is false;
    alter table public.round_one_votes drop column vote;
  end if;
end $$;

-- Only enforce NOT NULL if column is still nullable (fresh installs may already be NOT NULL)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'round_one_votes'
      and column_name = 'rank'
      and is_nullable = 'YES'
  ) then
    alter table public.round_one_votes alter column rank set not null;
  end if;
end $$;
