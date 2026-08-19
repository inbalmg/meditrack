-- MediTrack — Migration 06: staff directory (the clinic's staff roster shown in
-- Settings). Distinct from `profiles` (auth-linked login accounts): staff rows are
-- editable name+role entries managed by admins. RLS mirrors the other admin tables.

create table public.staff (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  name       text not null,
  role       text not null check (role in ('secretary','manager','therapist')),
  created_at timestamptz not null default now()
);
create index idx_staff_clinic on public.staff(clinic_id);

alter table public.staff enable row level security;
create policy staff_select_all on public.staff for select to authenticated
  using (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager','therapist'));
create policy staff_write_admin on public.staff for all to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));
