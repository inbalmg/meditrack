-- MediTrack — Migration 36: link a no-show follow-up task to its appointment.
-- Marking an appointment "לא הגיע" spawns an automatic follow-up task. If the secretary
-- clicked no-show by mistake, they can revert it (undo toast / board "שחזר") — which must
-- restore the appointment AND remove the exact task it spawned. This column links the
-- follow-up back to its source appointment so that lookup is deterministic.
--
-- Plain uuid (no FK) on purpose: the appointment status update and the task insert are
-- independent fire-and-forget writes, so an FK could race. The link is only used for an
-- in-memory lookup + hydration (same rationale as requests.converted_task_id, migration 29).
alter table public.tasks add column if not exists source_appointment_id uuid;
