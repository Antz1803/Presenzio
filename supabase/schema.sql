create extension if not exists pgcrypto;

create table if not exists school_years (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  semester text not null,
  unique (label, semester)
);

create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid references school_years(id) on delete cascade,
  subject_code text not null,
  subject_title text,
  edp_code text,
  year_level text,
  section_no text,
  room text,
  days text,
  time_start time,
  time_end time,
  teacher_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_no text,
  full_name text not null,
  gender text check (gender in ('M', 'F')),
  course text,
  year_level text,
  contact_no text,
  email text,
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists students_student_no_idx on students(student_no);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  ctrl_no int,
  status text not null default 'active'
    check (status in ('active', 'dropped', 'incomplete', 'not_active')),
  enrolled_on date default current_date,
  dropped_on date,
  unique (section_id, student_id)
);

create table if not exists grading_periods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('prelim', 'midterm', 'semifinal', 'final')),
  sort_order int not null unique,
  start_date date,
  end_date date,
  check (start_date is null or end_date is null or start_date <= end_date)
);

alter table if exists grading_periods
  add column if not exists start_date date;

alter table if exists grading_periods
  add column if not exists end_date date;

insert into grading_periods (code, sort_order) values
  ('prelim', 1), ('midterm', 2), ('semifinal', 3), ('final', 4)
on conflict (code) do nothing;

create table if not exists period_grades (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  period_id uuid not null references grading_periods(id),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  own_period_grade numeric(4,2),
  cumulative_grade numeric(4,2),
  computed_at timestamptz not null default now(),
  unique (section_id, period_id, enrollment_id)
);

create table if not exists assessment_scores (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  period_id uuid not null references grading_periods(id),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  category text not null check (category in ('quiz', 'assignment', 'activity', 'exam')),
  item_no int not null,
  score numeric(6,2) default 0,
  max_score numeric(6,2) not null default 20,
  recorded_at timestamptz not null default now(),
  unique (section_id, period_id, enrollment_id, category, item_no)
);

alter table if exists assessment_scores
  alter column score set default 0;

-- Assessment authoring content. Scores remain in assessment_scores; these
-- tables store the quiz, assignment, activity, and exam questions created by
-- the teacher.
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  period_id uuid not null references grading_periods(id),
  category text not null check (category in ('quiz', 'assignment', 'activity', 'exam')),
  item_no int not null check (item_no > 0),
  access_key text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  title text not null,
  instructions text,
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts int not null default 1,
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default now(),
  unique (access_key)
);

alter table if exists assessments add column if not exists access_key text;
alter table if exists assessments add column if not exists item_no int;
alter table if exists assessments add column if not exists max_attempts int not null default 1;
alter table if exists assessments add column if not exists available_from timestamptz;
alter table if exists assessments add column if not exists available_until timestamptz;
alter table if exists assessments add column if not exists time_limit_minutes int;
alter table if exists assessments
  alter column access_key set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
update assessments set max_attempts = 1 where max_attempts is null or max_attempts < 1;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assessments_max_attempts_check'
  ) then
    alter table assessments add constraint assessments_max_attempts_check check (max_attempts >= 1);
  end if;
end $$;
update assessments
set access_key = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
where access_key is null;
with ranked_assessments as (
  select
    id,
    row_number() over (
      partition by section_id, period_id, category
      order by created_at, id
    )::int as assigned_item_no
  from assessments
  where item_no is null
)
update assessments
set item_no = ranked_assessments.assigned_item_no
from ranked_assessments
where assessments.id = ranked_assessments.id;
create unique index if not exists assessments_access_key_idx on assessments(access_key);
create index if not exists assessments_score_item_idx
  on assessments(section_id, period_id, category, item_no);

create index if not exists assessments_section_id_idx on assessments(section_id);

create table if not exists assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_no int not null,
  question_type text not null check (question_type in ('multiple_choice', 'coding')),
  prompt text not null,
  points numeric(6,2) not null default 1,
  choices jsonb not null default '[]'::jsonb,
  correct_answer text,
  language text check (language in ('sql', 'c', 'cpp', 'csharp', 'javascript')),
  starter_code text,
  expected_output text,
  unique (assessment_id, question_no)
);

create index if not exists assessment_questions_assessment_id_idx
  on assessment_questions(assessment_id);

create table if not exists assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  attempt_no int not null default 1,
  status text not null default 'submitted'
    check (status in ('in_progress', 'submitted', 'needs_review')),
  score numeric(6,2) not null default 0,
  max_score numeric(6,2) not null default 0,
  submitted_at timestamptz not null default now(),
  started_at timestamptz,
  unique (assessment_id, student_id, attempt_no)
);

alter table if exists assessment_attempts add column if not exists attempt_no int not null default 1;
alter table if exists assessment_attempts add column if not exists started_at timestamptz;
do $$
declare
  old_status_constraint text;
begin
  select conname into old_status_constraint
  from pg_constraint
  where conrelid = 'assessment_attempts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%'
  limit 1;
  if old_status_constraint is not null then
    execute format('alter table assessment_attempts drop constraint %I', old_status_constraint);
  end if;
  alter table assessment_attempts
    add constraint assessment_attempts_status_check
    check (status in ('in_progress', 'submitted', 'needs_review'));
end $$;
update assessment_attempts set attempt_no = 1 where attempt_no is null or attempt_no < 1;
do $$
declare
  old_constraint text;
begin
  select conname into old_constraint
  from pg_constraint
  where conrelid = 'assessment_attempts'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) like '%(assessment_id, student_id)%'
    and pg_get_constraintdef(oid) not like '%attempt_no%'
  limit 1;
  if old_constraint is not null then
    execute format('alter table assessment_attempts drop constraint %I', old_constraint);
  end if;
end $$;
create unique index if not exists assessment_attempts_assessment_student_attempt_idx
  on assessment_attempts(assessment_id, student_id, attempt_no);

create table if not exists assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references assessment_attempts(id) on delete cascade,
  question_id uuid not null references assessment_questions(id) on delete cascade,
  answer text,
  is_correct boolean,
  points_earned numeric(6,2) not null default 0,
  unique (attempt_id, question_id)
);

create index if not exists assessment_attempts_student_id_idx
  on assessment_attempts(student_id);

-- A teacher can grant an additional attempt to one student without opening
-- another attempt for the entire class.
create table if not exists assessment_attempt_grants (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  extra_attempts int not null default 1 check (extra_attempts > 0),
  granted_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create index if not exists assessment_attempt_grants_assessment_id_idx
  on assessment_attempt_grants(assessment_id);

-- Security events are recorded before an auto-submit, including Escape,
-- leaving the tab, and clipboard/shortcut attempts.
create table if not exists assessment_violations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  attempt_no int not null default 1,
  violation_type text not null,
  details text,
  occurred_at timestamptz not null default now()
);

create index if not exists assessment_violations_assessment_student_idx
  on assessment_violations(assessment_id, student_id, occurred_at desc);

create index if not exists assessment_answers_attempt_id_idx
  on assessment_answers(attempt_id);

-- Development-only policies for the current unauthenticated frontend.
-- Replace these with authenticated teacher/student policies before production.
alter table if exists assessments enable row level security;
alter table if exists assessment_questions enable row level security;
alter table if exists assessment_attempts enable row level security;
alter table if exists assessment_answers enable row level security;
alter table if exists assessment_attempt_grants enable row level security;
alter table if exists assessment_violations enable row level security;

drop policy if exists "development access assessments" on assessments;
create policy "development access assessments"
  on assessments for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "development access assessment questions" on assessment_questions;
create policy "development access assessment questions"
  on assessment_questions for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "development access assessment attempts" on assessment_attempts;
create policy "development access assessment attempts"
  on assessment_attempts for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "development access assessment answers" on assessment_answers;
create policy "development access assessment answers"
  on assessment_answers for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "development access assessment attempt grants" on assessment_attempt_grants;
create policy "development access assessment attempt grants"
  on assessment_attempt_grants for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "development access assessment violations" on assessment_violations;
create policy "development access assessment violations"
  on assessment_violations for all to anon, authenticated
  using (true) with check (true);

create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  period_id uuid references grading_periods(id),
  session_date date not null,
  session_time text not null default 'PM' check (session_time in ('AM', 'PM')),
  unique (section_id, session_date, session_time)
);

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references class_sessions(id) on delete cascade,
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  marked_at timestamptz not null default now(),
  unique (session_id, enrollment_id)
);

-- Development-only access for the current unauthenticated frontend.
-- Replace these grants with authenticated RLS policies before production.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

