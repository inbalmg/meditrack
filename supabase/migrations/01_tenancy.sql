-- MediTrack — Migration 01: tenancy & identity
-- clinics = tenant root; profiles = bridge auth.users -> role/clinic.
-- RLS is intentionally NOT enabled here — it lands in migration 04 (roadmap step 3).

-- One row per clinic. `settings` folds the app's operational settings object
-- (remindersEnabled / reminderHours / autoNoShow / noShowMinutes / followUpOnNoShow).
create table public.clinics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  settings   jsonb not null default jsonb_build_object(
               'remindersEnabled', true,
               'reminderHours', 24,
               'autoNoShow', true,
               'noShowMinutes', 15,
               'followUpOnNoShow', true
             ),
  created_at timestamptz not null default now()
);

-- One row per authenticated user. Bridges Supabase Auth to the app's role + tenant.
-- role/clinic_id are also mirrored into JWT app_metadata (server-side) so RLS can
-- read them without a table lookup — see migration 04.
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  role       text not null check (role in ('secretary','manager','therapist','patient')),
  full_name  text,
  created_at timestamptz not null default now()
);

create index idx_profiles_clinic on public.profiles(clinic_id);
