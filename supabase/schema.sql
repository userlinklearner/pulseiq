-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Connected devices (Oura, Whoop, Garmin)
create table public.connected_devices (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  device_type   text not null check (device_type in ('oura', 'whoop', 'garmin', 'manual')),
  access_token  text,
  refresh_token text,
  token_expires_at timestamptz,
  last_synced_at   timestamptz,
  meta          jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  unique(user_id, device_type)
);

-- Daily unified metrics (one row per user per day per source)
create table public.daily_metrics (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  date                date not null,
  source              text not null check (source in ('oura', 'whoop', 'garmin', 'manual')),
  -- Sleep
  sleep_hours         numeric(4,2),
  sleep_deep_minutes  integer,
  sleep_rem_minutes   integer,
  sleep_light_minutes integer,
  sleep_score         integer,
  -- Recovery / HRV
  hrv_avg             numeric(6,2),
  resting_hr          integer,
  recovery_score      integer,
  spo2_avg            numeric(4,2),
  spo2_low            numeric(4,2),
  -- Strain / Stress
  strain_score        numeric(4,2),
  stress_avg          integer,
  body_battery_wake   integer,
  body_battery_end    integer,
  -- Steps / Activity
  steps               integer,
  active_calories     integer,
  -- Raw payload for future use
  raw                 jsonb default '{}'::jsonb,
  created_at          timestamptz default now(),
  unique(user_id, date, source)
);

-- Activities / workouts
create table public.activities (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  source          text not null,
  external_id     text,
  started_at      timestamptz not null,
  duration_secs   integer,
  activity_type   text,
  distance_meters numeric(10,2),
  calories        integer,
  avg_hr          integer,
  max_hr          integer,
  elevation_gain  numeric(8,2),
  notes           text,
  raw             jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  unique(user_id, source, external_id)
);

-- Manual wellness entries
create table public.manual_entries (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  date          date not null,
  -- Subjective scores (1-10)
  mood          integer check (mood between 1 and 10),
  energy        integer check (energy between 1 and 10),
  soreness      integer check (soreness between 1 and 10),
  motivation    integer check (motivation between 1 and 10),
  -- Manual training log
  activity_type text,
  duration_mins integer,
  rpe           integer check (rpe between 1 and 10),
  -- Free notes
  notes         text,
  created_at    timestamptz default now(),
  unique(user_id, date)
);

-- User profiles (name, age, goals)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  birth_year    integer,
  primary_sport text,
  goal          text,
  avatar_url    text,
  created_at    timestamptz default now()
);

-- Row Level Security
alter table public.connected_devices  enable row level security;
alter table public.daily_metrics      enable row level security;
alter table public.activities         enable row level security;
alter table public.manual_entries     enable row level security;
alter table public.profiles           enable row level security;

-- Policies: users see only their own data
create policy "own data" on public.connected_devices  for all using (auth.uid() = user_id);
create policy "own data" on public.daily_metrics      for all using (auth.uid() = user_id);
create policy "own data" on public.activities         for all using (auth.uid() = user_id);
create policy "own data" on public.manual_entries     for all using (auth.uid() = user_id);
create policy "own profile" on public.profiles        for all using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
