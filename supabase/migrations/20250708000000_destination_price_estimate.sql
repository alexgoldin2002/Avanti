-- Per-destination all-in price range (min viable → max luxury) for Round 1 cards.
alter table destination_analysis
  add column if not exists price_estimate jsonb;

comment on column destination_analysis.price_estimate is
  'Round 1 destination price range: min/max per person, budget fit, API breakdown';
