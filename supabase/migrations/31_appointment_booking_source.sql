-- MediTrack — Migration 31: appointment booking provenance.
-- The secretary can now book a call directly into the calendar (Direct Booking), so an
-- appointment records WHO created it and (via the existing `source` channel) HOW it was
-- booked. Two additions:
--   created_by : the profile that created the row (secretary/manager for desk bookings;
--                stays null for patient self-book / portal). Displayed in the appointment
--                detail + patient history ("נקבע ע״י …").
--   source     : widen the CHECK to add 'ביקור ללא תור' (walk-in) next to the existing
--                four channels. 'טלפון' now means a secretary booked a call directly (no
--                more AI request queue for phone calls).
alter table public.appointments
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.appointments drop constraint if exists appointments_source_check;
alter table public.appointments
  add constraint appointments_source_check
  check (source in ('הזמנה עצמית','הפניה דחופה','טלפון','פורטל','ביקור ללא תור'));

-- RLS unchanged: secretary/manager already INSERT/UPDATE appointments scoped by clinic_id
-- (migration 04); created_by is stamped client-side from auth.uid(). No new policy needed.
