-- Task archive + windowed completed-tasks board.
--
-- The board no longer loads the whole completed backlog: it hydrates open/in-progress
-- tasks plus only the last 15 days of completed ones. The full completed history lives
-- behind an on-demand, server-paginated "Task Archive" drawer (ordered by completion
-- time, newest first). Both paths key off completed_at.
--
-- completed_at was added to the live DB out-of-band and never captured in a migration;
-- (re)declare it idempotently here so the migration history matches reality, then add
-- the covering index the board window and the archive ordering both scan.

alter table public.tasks
  add column if not exists completed_at timestamptz;

-- Board 15-day window (clinic_id, status='הושלם', completed_at >= cutoff) and the
-- archive page ordering (status='הושלם' order by completed_at desc) both walk this.
create index if not exists idx_tasks_clinic_status_completed
  on public.tasks(clinic_id, status, completed_at desc);
