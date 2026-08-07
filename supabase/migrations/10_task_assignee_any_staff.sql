-- Tasks can be assigned to a therapist OR office staff (secretary / manager).
-- The original schema constrained tasks.assignee_id to therapists(id); drop that
-- FK so assignee_id may reference either a therapist or a staff member. The column
-- stays a nullable uuid, scoped by clinic_id + RLS; the app resolves the assignee
-- from both the therapists and staff pools (see store.jsx → assigneeById).
alter table public.tasks drop constraint if exists tasks_assignee_id_fkey;
