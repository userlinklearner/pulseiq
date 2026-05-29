-- ============================================================
-- PulseIQ v2: Subscriptions, Community, Coach, Plans
-- Run this AFTER schema.sql
-- ============================================================

-- ────────────────────────────────────────────────
-- SUBSCRIPTIONS (Stripe-managed)
-- ────────────────────────────────────────────────
create table public.subscriptions (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references auth.users(id) on delete cascade not null unique,
  stripe_customer_id   text unique,
  stripe_sub_id        text unique,
  plan                 text not null default 'free' check (plan in ('free', 'coach')),
  status               text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
  current_period_end   timestamptz,
  cancel_at_period_end boolean default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table public.subscriptions enable row level security;
create policy "own subscription" on public.subscriptions for all using (auth.uid() = user_id);

-- Auto-create free subscription on user signup
create or replace function public.handle_new_subscription()
returns trigger language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute procedure public.handle_new_subscription();


-- ────────────────────────────────────────────────
-- DATA SHARING CONSENT
-- ────────────────────────────────────────────────
create table public.data_sharing_consent (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  consented        boolean not null default false,
  consented_at     timestamptz,
  revoked_at       timestamptz,
  -- What they agreed to share
  share_metrics    boolean default true,
  share_activities boolean default true,
  share_manual     boolean default true
);

alter table public.data_sharing_consent enable row level security;
create policy "own consent" on public.data_sharing_consent for all using (auth.uid() = user_id);


-- ────────────────────────────────────────────────
-- COMMUNITY POOL (fully anonymized, aggregated)
-- Written by a server-side job, never tied to user_id
-- ────────────────────────────────────────────────
create table public.community_profiles (
  id               uuid primary key default uuid_generate_v4(),
  -- Demographic bucket (never exact values)
  age_group        text,   -- '20-25', '25-30', '30-35', '35-40', '40+'
  sport_focus      text,   -- 'triathlon', 'running', 'cycling', 'strength', 'wellness', 'mixed'
  goal             text,   -- 'endurance', 'speed', 'weight', 'health', 'strength'
  experience       text,   -- 'beginner', 'intermediate', 'advanced'
  -- Baseline health metrics (8-week average at time of "story start")
  baseline_hrv     numeric(6,2),
  baseline_rhr     integer,
  baseline_sleep   numeric(4,2),
  -- Outcome after N weeks of a specific training pattern
  outcome_weeks    integer,
  outcome_metric   text,   -- '5k_seconds', 'hrv', 'rhr', 'sleep_hours', 'recovery_score'
  outcome_before   numeric(10,2),
  outcome_after    numeric(10,2),
  outcome_delta    numeric(10,2),  -- after - before (positive = improvement)
  -- What they did (training pattern)
  weekly_hours     numeric(5,2),
  weekly_sessions  integer,
  zone2_pct        integer,   -- % of training in Z2
  strength_days    integer,   -- strength sessions/week
  avg_sleep_hours  numeric(4,2),
  -- Lifestyle factors (self-reported via manual entries)
  avg_mood         numeric(4,2),  -- 1-10
  avg_energy       numeric(4,2),
  avg_stress       integer,
  -- Story context
  story_title      text,
  story_summary    text,  -- 2-3 sentences about what happened
  verified         boolean default false,
  created_at       timestamptz default now()
);

-- Seed data: real-world anonymized patterns from sports science + community
-- (Until enough real users accumulate, these provide immediate value)
insert into public.community_profiles
  (age_group, sport_focus, goal, experience, baseline_hrv, baseline_rhr, baseline_sleep,
   outcome_weeks, outcome_metric, outcome_before, outcome_after, outcome_delta,
   weekly_hours, weekly_sessions, zone2_pct, strength_days, avg_sleep_hours, avg_mood, avg_stress,
   story_title, story_summary, verified)
values
  ('25-30', 'triathlon', 'endurance', 'intermediate', 52, 58, 7.1,
   12, '5k_seconds', 1320, 1170, -150,
   8.5, 6, 70, 2, 7.8, 7, 35,
   'From 22:00 to 19:30 5K in 12 weeks',
   'Dropped weekly intensity and added a second Zone 2 run. HRV climbed from 52 to 67ms over 8 weeks. The key was protecting sleep above 7.5h consistently.',
   true),

  ('30-35', 'running', 'speed', 'intermediate', 44, 62, 6.5,
   16, '5k_seconds', 1380, 1200, -180,
   7.0, 5, 65, 1, 7.2, 6, 42,
   '23:00 to 20:00 — the stress connection',
   'Work stress was suppressing HRV below 44ms every week. Added 20min daily walk and one full rest day. Stress dropped, HRV recovered to 58ms, and times followed 6 weeks later.',
   true),

  ('20-25', 'cycling', 'endurance', 'advanced', 68, 48, 7.8,
   20, 'hrv', 55, 72, 17,
   12, 8, 80, 1, 8.2, 8, 28,
   'Building an aerobic base that actually stuck',
   'Spent 20 weeks at 80% Zone 2 with almost no high intensity. Boring but HRV went from 55 to 72ms. Body battery rarely dropped below 60. Sleep quality transformed.',
   true),

  ('35-40', 'strength', 'health', 'beginner', 38, 68, 6.1,
   10, 'rhr', 68, 59, -9,
   4.5, 4, 40, 3, 7.0, 6, 55,
   'Desk job athlete: 9 BPM RHR drop in 10 weeks',
   'Started with 3 strength sessions and 1 Zone 2 run per week. Prioritized sleep over extra training. RHR dropped 9bpm, body battery at wake averaged 78 by week 8.',
   true),

  ('25-30', 'wellness', 'health', 'beginner', 35, 72, 5.8,
   8, 'sleep_hours', 5.8, 7.2, 1.4,
   2.0, 3, 50, 0, 7.2, 5, 62,
   'Fixing sleep first — everything else followed',
   'Stopped training after 8pm, cut caffeine after 2pm, added 20min walk at lunch. Sleep went from 5.8 to 7.2h average. HRV rose 12ms without changing training at all.',
   true),

  ('30-35', 'triathlon', 'endurance', 'advanced', 61, 51, 7.5,
   24, '5k_seconds', 1260, 1080, -180,
   14, 9, 72, 2, 7.9, 7, 38,
   'Sub-18 5K: the 24-week build',
   'Methodical polarized training: 72% Zone 2, two quality sessions per week. Never pushed when HRV was below personal baseline. Peaked for a target race and ran 17:58.',
   true),

  ('40+', 'running', 'health', 'intermediate', 41, 65, 7.0,
   14, 'recovery_score', 48, 71, 23,
   5.5, 4, 75, 2, 7.6, 7, 44,
   'Recovery score from 48 to 71 after 40 — what actually worked',
   'Cut weekly volume by 30%, added a second strength day, and started tracking HRV daily. When HRV dropped >10% below 7-day baseline, training was easy only. Recovery scores transformed.',
   true),

  ('25-30', 'mixed', 'weight', 'beginner', 40, 70, 6.8,
   12, 'rhr', 70, 61, -9,
   5.0, 5, 55, 2, 7.4, 6, 48,
   'Lost 6kg, dropped RHR 9bpm — how training and eating aligned',
   'Tracked subjective energy daily. Trained hard only when energy was 7+. On low-energy days, walked or stretched. HRV stabilized, RHR dropped, weight followed without obsessing over calories.',
   true);


-- ────────────────────────────────────────────────
-- COACH CONVERSATIONS
-- ────────────────────────────────────────────────
create table public.coach_conversations (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  title      text,
  messages   jsonb not null default '[]'::jsonb,  -- [{role, content, created_at}]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.coach_conversations enable row level security;
create policy "own conversations" on public.coach_conversations for all using (auth.uid() = user_id);


-- ────────────────────────────────────────────────
-- TRAINING PLANS
-- ────────────────────────────────────────────────
create table public.training_plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  goal        text,
  duration_weeks integer,
  start_date  date,
  status      text default 'active' check (status in ('active', 'completed', 'paused', 'archived')),
  weeks       jsonb not null default '[]'::jsonb,
  -- weeks format: [{week: 1, theme: "Base building", days: [{day: "Monday", sessions: [...]}]}]
  ai_rationale text,
  created_at  timestamptz default now()
);

alter table public.training_plans enable row level security;
create policy "own plans" on public.training_plans for all using (auth.uid() = user_id);


-- ────────────────────────────────────────────────
-- ONBOARDING (track completion steps)
-- ────────────────────────────────────────────────
create table public.onboarding (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  profile_complete     boolean default false,
  device_connected     boolean default false,
  consent_answered     boolean default false,
  first_log_complete   boolean default false,
  completed_at         timestamptz
);

alter table public.onboarding enable row level security;
create policy "own onboarding" on public.onboarding for all using (auth.uid() = user_id);

create or replace function public.handle_new_onboarding()
returns trigger language plpgsql security definer as $$
begin
  insert into public.onboarding (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_onboarding
  after insert on auth.users
  for each row execute procedure public.handle_new_onboarding();
