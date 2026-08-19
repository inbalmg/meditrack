-- MediTrack — Migration 20: required appointment fields.
--   source : NOT NULL + default. Every appointment has a real origin; until now the
--            approveRequest path (and older seed rows) inserted NULL, silently losing
--            the origin the request carried. The 4-value CHECK already exists (mig 02);
--            this adds the default + NOT NULL. App now propagates requests.source on
--            approval (store.jsx approveRequest), so the approve path stays valid.
--   end_at : NOT NULL. Materialized by the app.set_appointment_end trigger (mig 08) on
--            every insert/update — it powers the no-double-booking GiST exclusion. The
--            trigger always sets it, so NOT NULL just closes the theoretical gap.
-- Backfill NULL source first: inherit the linked request's source where one points back
-- (approved requests), otherwise the primary self-booking path 'הזמנה עצמית'.

update public.appointments a
  set source = r.source
  from public.requests r
  where r.appointment_id = a.id
    and a.source is null
    and r.source is not null;

update public.appointments set source = 'הזמנה עצמית' where source is null;

alter table public.appointments
  alter column source set default 'הזמנה עצמית',
  alter column source set not null,
  alter column end_at set not null;
