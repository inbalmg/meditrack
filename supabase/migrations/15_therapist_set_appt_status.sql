-- MediTrack — Migration 15: therapist marks their own visit arrived / completed.
--
-- Therapists run their own sessions, so they may move an appointment they conduct
-- along the visit lifecycle to 'הגיע' (arrived) or 'הסתיים' (completed) — and ONLY
-- those two statuses. No 'לא הגיע' (no-show stays a front-desk action, and its
-- follow-up automation lives on the staff path). As with set_clinical_note, use a
-- narrow SECURITY DEFINER RPC that updates ONLY the status column, only for a row
-- where therapist_id = the caller's therapist — no broad UPDATE grant on appointments.

create or replace function public.set_appointment_status(p_appt uuid, p_status text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if p_status not in ('הגיע', 'הסתיים') then
    raise exception 'status % not allowed for therapist', p_status;
  end if;
  update public.appointments
     set status = p_status
   where id = p_appt
     and therapist_id = app.therapist_id();
  if not found then
    raise exception 'not allowed to update this appointment';
  end if;
end;
$$;

revoke all on function public.set_appointment_status(uuid, text) from public;
grant execute on function public.set_appointment_status(uuid, text) to authenticated;
