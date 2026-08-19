-- MediTrack — Migration 12: therapists manage their OWN tasks.
-- Until now the Task Board was staff-only for writes and therapists had read-only
-- access to tasks assigned to them. The product now lets a therapist view, create,
-- and update ONLY their own tasks: those assigned to them OR created by them.
--
-- "Created by them" needs a creator stamp, so add tasks.created_by -> profiles(id)
-- (= auth.uid()). Existing rows keep NULL (created by staff automations/UI). Then add
-- therapist-scoped SELECT/INSERT/UPDATE policies. No DELETE for therapists (out of
-- scope). RLS stays the enforcement layer; the frontend guard is UX only.

alter table public.tasks
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- Read: own tasks = assigned to me OR created by me.
drop policy if exists tasks_select_therapist on public.tasks;
create policy tasks_select_therapist on public.tasks for select to authenticated
  using (app.jwt_role() = 'therapist'
    and (assignee_id = app.therapist_id() or created_by = auth.uid()));

-- Create: only within my clinic, stamped as mine, and only assignable to myself.
create policy tasks_insert_therapist on public.tasks for insert to authenticated
  with check (app.jwt_role() = 'therapist'
    and clinic_id = app.clinic_id()
    and created_by = auth.uid()
    and assignee_id = app.therapist_id());

-- Update: only my own tasks (assigned to me OR created by me), and I can't hand a
-- task off to someone else (the new row must still be mine).
create policy tasks_update_therapist on public.tasks for update to authenticated
  using      (app.jwt_role() = 'therapist'
    and (assignee_id = app.therapist_id() or created_by = auth.uid()))
  with check (app.jwt_role() = 'therapist'
    and (assignee_id = app.therapist_id() or created_by = auth.uid()));
