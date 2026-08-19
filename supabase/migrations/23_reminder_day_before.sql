-- MediTrack — Migration 23: simplify appointment reminders to a "day before" toggle.
-- The granular `reminderHours` numeric setting is replaced by a boolean
-- `reminderDayBefore` (checkbox in Settings). The daily reminder sweep now gates on
-- BOTH `remindersEnabled` AND `reminderDayBefore`, and dispatches for appointments
-- happening within the next day (i.e. the day before the appointment).

-- 1. New clinics: default settings carry reminderDayBefore instead of reminderHours.
alter table public.clinics
  alter column settings set default jsonb_build_object(
    'remindersEnabled', true,
    'reminderDayBefore', true,
    'autoNoShow', true,
    'noShowMinutes', 15,
    'followUpOnNoShow', true
  );

-- 2. Existing clinics: add reminderDayBefore (default on) and drop reminderHours.
update public.clinics
set settings = (settings - 'reminderHours')
             || jsonb_build_object('reminderDayBefore',
                  coalesce((settings->>'reminderDayBefore')::boolean, true));

-- 3. Reminder sweep: send only when reminders are enabled AND the day-before toggle
--    is on, for appointments due within the next day. reminder_sent_at still guards
--    against re-sending; dispatch happens only if a service key is stored in Vault.
create or replace function app.queue_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare r record; svc text;
begin
  select decrypted_secret into svc from vault.decrypted_secrets where name = 'edge_service_key' limit 1;
  for r in
    select a.id
    from public.appointments a
    join public.clinics c on c.id = a.clinic_id
    where a.status = 'קבוע'
      and a.reminder_sent_at is null
      and coalesce((c.settings->>'remindersEnabled')::boolean, false)
      and coalesce((c.settings->>'reminderDayBefore')::boolean, false)
      and a.start > now()
      and a.start <= now() + interval '1 day'
  loop
    update public.appointments set reminder_sent_at = now() where id = r.id;
    if svc is not null then
      perform net.http_post(
        url := 'https://nmiuydgwrogcqrpegdye.supabase.co/functions/v1/send-reminder',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc, 'apikey', svc),
        body := jsonb_build_object('appointmentId', r.id)
      );
    end if;
  end loop;
end $$;

revoke all on function app.queue_reminders() from public, anon, authenticated;
