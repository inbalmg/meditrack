-- MediTrack — Migration 24: collapse the reminder settings to a single toggle and
-- send the day-before reminder over BOTH channels (email + WhatsApp/SMS).
-- The `reminderDayBefore` boolean is folded back into `remindersEnabled` (one control
-- in Settings). The daily sweep now gates only on `remindersEnabled` and dispatches
-- the send-reminder function once per channel: default (WhatsApp/SMS) and email.

-- 1. New clinics: default settings drop reminderDayBefore.
alter table public.clinics
  alter column settings set default jsonb_build_object(
    'remindersEnabled', true,
    'autoNoShow', true,
    'noShowMinutes', 15,
    'followUpOnNoShow', true
  );

-- 2. Existing clinics: remove the now-unused reminderDayBefore key.
update public.clinics
set settings = settings - 'reminderDayBefore';

-- 3. Reminder sweep: send when reminders are enabled, for appointments due within the
--    next day, over both channels. reminder_sent_at guards against re-sending; the
--    email post is a no-op when the patient has no email on record (send-reminder 400s).
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
      and a.start > now()
      and a.start <= now() + interval '1 day'
  loop
    update public.appointments set reminder_sent_at = now() where id = r.id;
    if svc is not null then
      -- WhatsApp/SMS (default channel).
      perform net.http_post(
        url := 'https://nmiuydgwrogcqrpegdye.supabase.co/functions/v1/send-reminder',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc, 'apikey', svc),
        body := jsonb_build_object('appointmentId', r.id)
      );
      -- Email (no-op when the patient has no email on record).
      perform net.http_post(
        url := 'https://nmiuydgwrogcqrpegdye.supabase.co/functions/v1/send-reminder',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc, 'apikey', svc),
        body := jsonb_build_object('appointmentId', r.id, 'channel', 'email')
      );
    end if;
  end loop;
end $$;

revoke all on function app.queue_reminders() from public, anon, authenticated;
