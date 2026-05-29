-- ============================================================
-- PulseIQ v4: Roles, Professional Relationships, Notes
-- Run AFTER schema_v1 through v3
-- ============================================================

-- ────────────────────────────────────────────────
-- ROLES: extend the profiles table
-- ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists role text not null default 'athlete'
  check (role in ('athlete', 'coach', 'doctor'));

alter table public.profiles
  add column if not exists specialty   text,   -- for doctors: 'sports medicine', 'cardiology', etc.
  add column if not exists credentials text,   -- e.g. 'MD, FACC' or 'CSCS, USAT Level 2'
  add column if not exists bio         text;   -- professional summary


-- ────────────────────────────────────────────────
-- PROFESSIONAL RELATIONSHIPS
-- An athlete invites a doctor/coach, or vice versa.
-- The athlete controls all access permissions.
-- ────────────────────────────────────────────────
create table public.professional_relationships (
  id                  uuid primary key default uuid_generate_v4(),
  professional_id     uuid references auth.users(id) on delete cascade not null,
  athlete_id          uuid references auth.users(id) on delete cascade not null,
  relationship_type   text not null check (relationship_type in ('coach', 'doctor')),
  status              text not null default 'pending'
                      check (status in ('pending', 'active', 'revoked')),
  invite_token        text unique default encode(gen_random_bytes(24), 'hex'),
  invited_by          uuid references auth.users(id), -- who sent the invite
  invited_at          timestamptz default now(),
  accepted_at         timestamptz,
  revoked_at          timestamptz,
  -- Athlete-controlled access permissions
  can_view_metrics    boolean not null default true,
  can_view_activities boolean not null default true,
  can_view_exams      boolean not null default true,
  can_view_events     boolean not null default true,
  can_view_manual     boolean not null default true,
  can_add_exams       boolean not null default true,
  can_add_notes       boolean not null default true,
  can_create_plans    boolean not null default false, -- coaches only
  -- Note to professional
  message             text,
  unique(professional_id, athlete_id)
);

alter table public.professional_relationships enable row level security;

-- Athlete can see/manage their relationships, professional can see their relationships
create policy "rel_athlete_access" on public.professional_relationships
  for all using (auth.uid() = athlete_id OR auth.uid() = professional_id);


-- ────────────────────────────────────────────────
-- PROFESSIONAL NOTES
-- Doctors and coaches leave notes on athletes.
-- Visible to both the athlete and the professional.
-- ────────────────────────────────────────────────
create table public.professional_notes (
  id               uuid primary key default uuid_generate_v4(),
  professional_id  uuid references auth.users(id) on delete cascade not null,
  athlete_id       uuid references auth.users(id) on delete cascade not null,
  note_type        text not null default 'general'
                   check (note_type in ('medical','coaching','recommendation','concern','flag','exam_note')),
  title            text,
  body             text not null,
  is_private       boolean default false, -- if true, only the professional sees it
  pinned           boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.professional_notes enable row level security;

-- Athlete sees notes about them (unless private), professional sees their own notes
create policy "notes_athlete_read" on public.professional_notes
  for select using (
    (auth.uid() = athlete_id and is_private = false) OR
    auth.uid() = professional_id
  );
create policy "notes_professional_write" on public.professional_notes
  for insert with check (auth.uid() = professional_id);
create policy "notes_professional_update" on public.professional_notes
  for update using (auth.uid() = professional_id);
create policy "notes_professional_delete" on public.professional_notes
  for delete using (auth.uid() = professional_id);


-- ────────────────────────────────────────────────
-- UPDATE RLS POLICIES TO ALLOW PROFESSIONAL ACCESS
-- Professionals can read athlete data if relationship is active
-- ────────────────────────────────────────────────

-- Helper function: checks if current user has active professional relationship with target user
create or replace function public.has_professional_access(
  target_user_id uuid,
  permission_col text default 'can_view_metrics'
) returns boolean language plpgsql security definer as $$
declare
  result boolean;
begin
  execute format(
    'select exists(
      select 1 from public.professional_relationships
      where professional_id = $1
        and athlete_id = $2
        and status = ''active''
        and %I = true
    )', permission_col
  ) into result using auth.uid(), target_user_id;
  return coalesce(result, false);
end;
$$;

-- Daily metrics: allow professional access
drop policy if exists "own data" on public.daily_metrics;
create policy "own data" on public.daily_metrics
  for select using (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_view_metrics')
  );
create policy "own data write" on public.daily_metrics
  for insert with check (auth.uid() = user_id);
create policy "own data update" on public.daily_metrics
  for update using (auth.uid() = user_id);

-- Activities
drop policy if exists "own data" on public.activities;
create policy "own data" on public.activities
  for select using (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_view_activities')
  );
create policy "own data write" on public.activities
  for insert with check (auth.uid() = user_id);

-- Medical exams: professionals can view AND insert (if can_add_exams)
drop policy if exists "own exams" on public.medical_exams;
create policy "own exams read" on public.medical_exams
  for select using (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_view_exams')
  );
create policy "own exams write" on public.medical_exams
  for insert with check (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_add_exams')
  );
create policy "own exams update" on public.medical_exams
  for update using (auth.uid() = user_id);

-- Biomarker values: follow exam access
drop policy if exists "own biomarkers" on public.biomarker_values;
create policy "own biomarkers read" on public.biomarker_values
  for select using (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_view_exams')
  );
create policy "own biomarkers write" on public.biomarker_values
  for insert with check (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_add_exams')
  );

-- Manual entries: professionals can view
drop policy if exists "own data" on public.manual_entries;
create policy "own manual read" on public.manual_entries
  for select using (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_view_manual')
  );
create policy "own manual write" on public.manual_entries
  for insert with check (auth.uid() = user_id);
create policy "own manual update" on public.manual_entries
  for update using (auth.uid() = user_id);

-- Life events
drop policy if exists "own life_events" on public.life_events;
create policy "own events read" on public.life_events
  for select using (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_view_events')
  );
create policy "own events write" on public.life_events
  for insert with check (auth.uid() = user_id);
create policy "own events update" on public.life_events
  for update using (auth.uid() = user_id);

-- Training plans: coaches can create for athletes
drop policy if exists "own plans" on public.training_plans;
create policy "own plans read" on public.training_plans
  for select using (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_view_activities')
  );
create policy "own plans write" on public.training_plans
  for insert with check (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_create_plans')
  );
create policy "own plans update" on public.training_plans
  for update using (
    auth.uid() = user_id OR
    has_professional_access(user_id, 'can_create_plans')
  );

-- Profiles: professionals can view athlete profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile all" on public.profiles
  for all using (auth.uid() = id);
create policy "professional profile read" on public.profiles
  for select using (
    exists(
      select 1 from public.professional_relationships
      where professional_id = auth.uid()
        and athlete_id = id
        and status = 'active'
    )
  );
