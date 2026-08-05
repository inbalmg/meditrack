-- MediTrack — Migration 08: hardening. Server-side guard against double-booking a
-- provider: no two appointments for the same therapist may overlap in time. Backstop
-- under the UI (which already hides taken slots) for concurrent/racy bookings.
-- No-shows ('לא הגיע') are excluded so a missed slot can be rebooked.
--
-- The overlap range needs an IMMUTABLE expression, but `timestamptz + interval` and
-- `extract(epoch from timestamptz)` are only STABLE (timezone/DST aware). So we
-- persist `end_at` via a trigger and build the exclusion on two plain timestamptz
-- columns (tstzrange of two timestamptz IS immutable).

create extension if not exists btree_gist with schema extensions;  -- keep out of public (lint 0014)

alter table public.appointments add column if not exists end_at timestamptz;

create or replace function app.set_appointment_end()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.end_at := new.start + make_interval(mins => coalesce(new.duration_min, 30));
  return new;
end $$;

drop trigger if exists appointments_set_end on public.appointments;
create trigger appointments_set_end
  before insert or update of start, duration_min on public.appointments
  for each row execute function app.set_appointment_end();

update public.appointments
  set end_at = start + make_interval(mins => coalesce(duration_min, 30))
  where end_at is null;

alter table public.appointments
  add constraint appointments_no_double_booking
  exclude using gist (
    therapist_id with =,
    tstzrange(start, end_at) with &&
  )
  where (status <> 'לא הגיע');
