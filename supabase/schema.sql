create extension if not exists pgcrypto;

create table if not exists public.workout_entries (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  profile_id text not null default 'default',
  entry_date date not null,
  exercise text not null,
  sets jsonb not null,
  cardio jsonb,
  note text,
  created_at timestamptz not null default now()
);

alter table public.workout_entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists cardio jsonb;

create index if not exists workout_entries_user_date_idx
  on public.workout_entries (user_id, entry_date desc, created_at desc);

create table if not exists public.protein_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  profile_id text not null default 'default',
  entry_date date not null,
  grams numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.protein_entries
  add column if not exists id uuid,
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.protein_entries
set id = gen_random_uuid()
where id is null;

alter table public.protein_entries
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.protein_entries
  drop constraint if exists protein_entries_pkey;

alter table public.protein_entries
  add constraint protein_entries_pkey primary key (id);

create unique index if not exists protein_entries_user_date_unique_idx
  on public.protein_entries (user_id, entry_date)
  where user_id is not null;

alter table public.workout_entries enable row level security;
alter table public.protein_entries enable row level security;

drop policy if exists "Allow anon workout reads" on public.workout_entries;
drop policy if exists "Allow anon workout inserts" on public.workout_entries;
drop policy if exists "Allow anon workout deletes" on public.workout_entries;
drop policy if exists "Users can read own workouts" on public.workout_entries;
drop policy if exists "Users can insert own workouts" on public.workout_entries;
drop policy if exists "Users can delete own workouts" on public.workout_entries;

create policy "Users can read own workouts"
  on public.workout_entries
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own workouts"
  on public.workout_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own workouts"
  on public.workout_entries
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Allow anon protein reads" on public.protein_entries;
drop policy if exists "Allow anon protein inserts" on public.protein_entries;
drop policy if exists "Allow anon protein updates" on public.protein_entries;
drop policy if exists "Users can read own protein" on public.protein_entries;
drop policy if exists "Users can insert own protein" on public.protein_entries;
drop policy if exists "Users can update own protein" on public.protein_entries;

create policy "Users can read own protein"
  on public.protein_entries
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own protein"
  on public.protein_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own protein"
  on public.protein_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
