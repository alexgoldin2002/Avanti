-- Round 1: replace yes/no votes with ranked ordering (1 = top choice)

alter table public.round_one_votes add column if not exists rank integer check (rank >= 1);

update public.round_one_votes
set rank = 1
where rank is null and vote is true;

update public.round_one_votes
set rank = 999
where rank is null and vote is false;

alter table public.round_one_votes drop column if exists vote;

alter table public.round_one_votes alter column rank set not null;
