-- MediTrack — Migration 14: therapist deletes own tasks + writes visit summaries.
--
-- 1) DELETE on tasks for therapists, scoped to their own tasks (assigned to them OR
--    created by them) — same ownership rule as their select/update policies (mig 12).
--
-- 2) A therapist may author the clinical note (visit summary) on a visit THEY conducted.
--    Rather than granting a broad UPDATE on appointments (which would also expose
--    status/reason/etc.), expose a narrow SECURITY DEFINER RPC that writes ONLY
--    appointments.clinical_note, and only for a row where therapist_id = the caller's
--    therapist. Least privilege; RLS/ownership stays the enforcement layer.

-- ---- 1) therapist deletes own tasks --------------------------------------------
create policy tasks_delete_therapist on public.tasks for delete to authenticated
  using (app.jwt_role() = 'therapist'
    and (assignee_id = app.therapist_id() or created_by = auth.uid()));

-- ---- 2) therapist writes a visit summary (only that column, only own visits) ----
create or replace function public.set_clinical_note(p_appt uuid, p_note text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.appointments
     set clinical_note = p_note
   where id = p_appt
     and therapist_id = app.therapist_id();
  if not found then
    raise exception 'not allowed to edit this appointment';
  end if;
end;
$$;

revoke all on function public.set_clinical_note(uuid, text) from public;
grant execute on function public.set_clinical_note(uuid, text) to authenticated;
