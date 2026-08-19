-- MediTrack — Migration 02: core domain tables (mirror of src/data/seed.js).
-- Every table carries clinic_id (multi-tenant isolation key). Hebrew status/source
-- values are pinned by CHECK so display code is unchanged. RLS lands in migration 04.

-- Providers.
create table public.therapists (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null, -- links a provider to their login (nullable)
  name       text not null,
  specialty  text,
  color      text,
  initials   text,
  created_at timestamptz not null default now()
);

-- Treatments = source of truth for the self-booking model.
create table public.treatments (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  name         text not null,
  duration_min int not null default 30,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- M:N treatments <-> therapists (replaces the therapistIds[] array in seed.js).
create table public.treatment_providers (
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  primary key (treatment_id, therapist_id)
);

-- Patients. profile_id nullable: phone-book-only records (created by secretary) have no login.
create table public.patients (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name       text not null,
  phone      text,
  age        int,
  gender     text,
  created_at timestamptz not null default now()
);

-- The clinic calendar. visit_type is the denormalized treatment name (kept for display).
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  therapist_id uuid not null references public.therapists(id) on delete restrict,
  treatment_id uuid references public.treatments(id) on delete set null,
  start        timestamptz not null,
  duration_min int not null default 30,
  visit_type   text,
  status       text not null default 'קבוע' check (status in ('קבוע','הגיע','הסתיים','לא הגיע')),
  source       text check (source in ('הזמנה עצמית','הפניה דחופה','טלפון','פורטל')),
  reason       text,
  created_at   timestamptz not null default now()
);

-- The exceptions queue. ai persists the classifier output; appointment_id links the
-- appointment created on approval.
create table public.requests (
  id                     uuid primary key default gen_random_uuid(),
  clinic_id              uuid not null references public.clinics(id) on delete cascade,
  patient_id             uuid references public.patients(id) on delete cascade,
  description            text,
  preferred_therapist_id uuid references public.therapists(id) on delete set null,
  visit_type_hint        text,
  preferred_time         text,
  source                 text,
  status                 text not null default 'ממתין' check (status in ('ממתין','אושר','נדחה')),
  ai                     jsonb,
  appointment_id         uuid references public.appointments(id) on delete set null,
  created_at             timestamptz not null default now()
);

-- Staff tasks (follow-ups). assignee_id -> therapists; source_at anchors the task to
-- the triggering event (e.g. the no-show appointment time).
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  title       text not null,
  patient_id  uuid references public.patients(id) on delete set null,
  assignee_id uuid references public.therapists(id) on delete set null,
  source_at   timestamptz,
  due         timestamptz,
  status      text not null default 'פתוח' check (status in ('פתוח','בטיפול','הושלם')),
  source      text not null default 'ידני' check (source in ('אוטומציה','ידני')),
  note        text,
  created_at  timestamptz not null default now()
);
