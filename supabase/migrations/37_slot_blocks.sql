-- MediTrack — Migration 37: manual calendar slot blocks (חסימת משבצות ידנית).
-- A block reserves clinic time that is NOT an appointment — a lunch break, a day off,
-- a holiday, maintenance. Blocked time is excluded from the bookable-slot generation
-- (QuickBookDialog / NewRequest) and drawn as a gray band on the calendars.
--
-- Scope: therapist_id NULL = whole-clinic block (blocks every provider); a set
-- therapist_id blocks only that provider. Same nullable-owner pattern the product
-- model calls for ("both" — per-therapist and clinic-wide).

create table public.slot_blocks (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  therapist_id uuid references public.therapists(id) on delete cascade,   -- NULL = כל הקליניקה
  start        timestamptz not null,
  duration_min int not null default 30,
  reason       text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_slot_blocks_clinic_start on public.slot_blocks(clinic_id, start);

-- ------------------------------------------------------------------- RLS --------
-- Reads are clinic-wide for every role: the patient self-booking flow must exclude
-- blocked slots too, so patients (and therapists) need to SELECT blocks — mirrors the
-- therapists/treatments "all roles read" policy. Writes: staff manage all blocks in the
-- clinic; a therapist may manage only their OWN blocks (therapist_id = app.therapist_id()),
-- never a clinic-wide (NULL) or another provider's block.
alter table public.slot_blocks enable row level security;

create policy blocks_select_clinic on public.slot_blocks for select to authenticated
  using (clinic_id = app.clinic_id());

create policy blocks_write_staff on public.slot_blocks for all to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

create policy blocks_write_therapist_own on public.slot_blocks for all to authenticated
  using      (app.jwt_role() = 'therapist' and clinic_id = app.clinic_id() and therapist_id = app.therapist_id())
  with check (app.jwt_role() = 'therapist' and clinic_id = app.clinic_id() and therapist_id = app.therapist_id());

-- ------------------------------------------------------------- Realtime ----------
-- Broadcast block changes on the same publication as the calendar tables so an open
-- calendar reflects a new/removed block live. Reuses the SELECT RLS above (clinic-wide).
alter publication supabase_realtime add table public.slot_blocks;
alter table public.slot_blocks replica identity full;
