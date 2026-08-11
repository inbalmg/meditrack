-- MediTrack — Migration 11: remove the auto no-show automation.
-- The product model treats a past 'קבוע' appointment that was never checked in as
-- *unresolved-past* — DERIVED state (lib/appointments.js → isUnresolvedPast), resolved
-- by a human on the Task Board ("תורים שלא טופלו"). There must be NO silent mutation:
-- the client never auto-writes a no-show, and neither should the server. The cron from
-- migration 07 (app.auto_no_show) violated this by flipping overdue 'קבוע' → 'לא הגיע',
-- so missed slots surfaced as No-Show in the calendar instead of the Task Board queue.
-- Drop the job and the function. The reminder sweep (queue_reminders) is unaffected.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'meditrack-auto-no-show') then
    perform cron.unschedule('meditrack-auto-no-show');
  end if;
end $$;

drop function if exists app.auto_no_show();
