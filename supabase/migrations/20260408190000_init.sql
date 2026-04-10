create extension if not exists pgcrypto;

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('text', 'pdf')),
  raw_text text not null,
  storage_path text,
  token_estimate integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  prompt text not null,
  ideal_answer text not null,
  key_concepts text[] not null default '{}',
  question_type text not null check (question_type in ('conceptual', 'application')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  answer_text text not null,
  score_percent integer not null check (score_percent between 0 and 100),
  quality integer not null check (quality between 0 and 5),
  missing_concepts text[] not null default '{}',
  misconceptions text[] not null default '{}',
  model_answer text not null,
  explanation_short text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.review_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  repetition integer not null default 0,
  interval_days integer not null default 0,
  ease_factor numeric not null default 2.5,
  next_review_at timestamptz not null default now(),
  last_quality integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index if not exists idx_materials_user on public.materials(user_id, created_at desc);
create index if not exists idx_decks_user on public.decks(user_id, created_at desc);
create index if not exists idx_cards_deck on public.cards(deck_id, position);
create index if not exists idx_attempts_user_card on public.attempts(user_id, card_id, created_at desc);
create index if not exists idx_review_state_next on public.review_state(user_id, next_review_at asc);

alter table public.materials enable row level security;
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.review_state enable row level security;

drop policy if exists materials_owner on public.materials;
create policy materials_owner on public.materials
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists decks_owner on public.decks;
create policy decks_owner on public.decks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists cards_owner on public.cards;
create policy cards_owner on public.cards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists sessions_owner on public.sessions;
create policy sessions_owner on public.sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists attempts_owner on public.attempts;
create policy attempts_owner on public.attempts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists review_state_owner on public.review_state;
create policy review_state_owner on public.review_state
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
