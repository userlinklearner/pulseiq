-- ============================================================
-- PulseIQ v3: Forum, Life Events, Medical Exams
-- Run AFTER schema.sql and schema_v2.sql
-- ============================================================

-- ────────────────────────────────────────────────
-- FORUM
-- ────────────────────────────────────────────────
create table public.forum_posts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  body        text not null,
  category    text not null default 'general'
              check (category in ('training','nutrition','recovery','gear','race_reports','mental','science','general')),
  upvotes     integer not null default 0,
  comment_count integer not null default 0,
  pinned      boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table public.forum_comments (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid references public.forum_posts(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  parent_id   uuid references public.forum_comments(id) on delete cascade,
  body        text not null,
  upvotes     integer not null default 0,
  created_at  timestamptz default now()
);

create table public.forum_votes (
  user_id     uuid references auth.users(id) on delete cascade not null,
  target_id   uuid not null,
  target_type text not null check (target_type in ('post','comment')),
  value       integer not null check (value in (1,-1)),
  created_at  timestamptz default now(),
  primary key (user_id, target_id)
);

-- RLS
alter table public.forum_posts    enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_votes    enable row level security;

create policy "forum_posts_read"    on public.forum_posts    for select using (true);
create policy "forum_posts_write"   on public.forum_posts    for insert with check (auth.uid() = user_id);
create policy "forum_posts_update"  on public.forum_posts    for update using (auth.uid() = user_id);
create policy "forum_posts_delete"  on public.forum_posts    for delete using (auth.uid() = user_id);

create policy "forum_comments_read"   on public.forum_comments for select using (true);
create policy "forum_comments_write"  on public.forum_comments for insert with check (auth.uid() = user_id);
create policy "forum_comments_delete" on public.forum_comments for delete using (auth.uid() = user_id);

create policy "forum_votes_all" on public.forum_votes for all using (auth.uid() = user_id);

-- Function to update upvote counts atomically
create or replace function public.handle_forum_vote()
returns trigger language plpgsql security definer as $$
begin
  if new.target_type = 'post' then
    update public.forum_posts
    set upvotes = upvotes + new.value
    where id = new.target_id;
  elsif new.target_type = 'comment' then
    update public.forum_comments
    set upvotes = upvotes + new.value
    where id = new.target_id;
  end if;
  return new;
end;
$$;

create trigger on_forum_vote
  after insert on public.forum_votes
  for each row execute procedure public.handle_forum_vote();

-- Update comment count on post
create or replace function public.handle_comment_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.forum_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif TG_OP = 'DELETE' then
    update public.forum_posts set comment_count = comment_count - 1 where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_comment_change
  after insert or delete on public.forum_comments
  for each row execute procedure public.handle_comment_count();

-- Seed posts
insert into public.forum_posts (user_id, title, body, category, upvotes, comment_count, pinned)
select
  (select id from auth.users limit 1),
  'Welcome to PulseIQ Community — introduce yourself!',
  'This is the place to connect with other athletes and health-focused people. Share your background, your goals, and what brought you here. What device are you using? What are you training for?',
  'general', 24, 0, true
where exists (select 1 from auth.users limit 1);


-- ────────────────────────────────────────────────
-- LIFE EVENTS
-- Tracks anything that can impact health data
-- ────────────────────────────────────────────────
create table public.life_events (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  date          date not null,
  end_date      date,           -- for multi-day events (trips, illness)
  title         text not null,
  category      text not null default 'personal'
                check (category in ('social','travel','health','work','substance','nutrition','personal')),
  -- Impact factors (can combine multiple)
  impacts       text[] default '{}',
  -- impacts values: 'alcohol','smoking','poor_sleep','stress','physical_demand',
  --                 'diet_change','medication','illness','injury','time_zone'
  severity      integer check (severity between 1 and 5),  -- 1=minor, 5=major
  notes         text,
  created_at    timestamptz default now()
);

alter table public.life_events enable row level security;
create policy "own life_events" on public.life_events for all using (auth.uid() = user_id);

-- Categories with icons and colors (stored as metadata for frontend)
comment on column public.life_events.category is
'social=🎉, travel=✈️, health=🏥, work=💼, substance=🍺, nutrition=🥗, personal=📅';


-- ────────────────────────────────────────────────
-- MEDICAL EXAMS & BIOMARKERS
-- ────────────────────────────────────────────────
create table public.medical_exams (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  exam_date   date not null,
  title       text not null,
  exam_type   text not null default 'blood_work'
              check (exam_type in ('blood_work','vo2max','body_composition','ecg','dexa','imaging','other')),
  provider    text,   -- doctor/lab name
  notes       text,
  file_url    text,   -- PDF upload (Supabase Storage)
  created_at  timestamptz default now()
);

-- Individual biomarker values within an exam
create table public.biomarker_values (
  id          uuid primary key default uuid_generate_v4(),
  exam_id     uuid references public.medical_exams(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,   -- 'Ferritin', 'HbA1c', 'Testosterone', etc.
  value       numeric(12,4) not null,
  unit        text,            -- 'ng/mL', '%', 'mg/dL', etc.
  ref_low     numeric(12,4),   -- normal range low
  ref_high    numeric(12,4),   -- normal range high
  flag        text check (flag in ('normal','low','high','critical_low','critical_high')),
  created_at  timestamptz default now()
);

alter table public.medical_exams   enable row level security;
alter table public.biomarker_values enable row level security;

create policy "own exams"      on public.medical_exams    for all using (auth.uid() = user_id);
create policy "own biomarkers" on public.biomarker_values for all using (auth.uid() = user_id);

-- Auto-flag biomarkers based on reference range
create or replace function public.auto_flag_biomarker()
returns trigger language plpgsql as $$
begin
  if new.ref_low is not null and new.ref_high is not null then
    if    new.value < new.ref_low  * 0.7  then new.flag := 'critical_low';
    elsif new.value < new.ref_low          then new.flag := 'low';
    elsif new.value > new.ref_high * 1.3  then new.flag := 'critical_high';
    elsif new.value > new.ref_high         then new.flag := 'high';
    else                                        new.flag := 'normal';
    end if;
  end if;
  return new;
end;
$$;

create trigger before_biomarker_insert
  before insert or update on public.biomarker_values
  for each row execute procedure public.auto_flag_biomarker();
