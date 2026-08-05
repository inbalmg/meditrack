-- MediTrack — Migration 07: scheduled automations (pg_cron + pg_net).
-- Two server-side sweeps that honor each clinic's settings jsonb:
--   • auto_no_show   — flips overdue 'קבוע' → 'לא הגיע' + spawns a follow-up task
--   • queue_reminders — marks appointments due for a reminder and (when a service
--                       key is stored in Vault) invokes the send-reminder function
-- Both are SECURITY DEFINER (run as owner, bypass RLS) and NOT client-callable.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.appointments add column if not exists reminder_sent_at timestamptz;

-- --- Auto no-show: overdue confirmed appointment → 'לא הגיע' (+ follow-up task) ---
create or replace function app.auto_no_show()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select a.id, a.clinic_id, a.patient_id, a.therapist_id, a.start, p.name as pname,
           coalesce((c.settings->>'noShowMinutes')::int, 15) as grace,
           coalesce((c.settings->>'followUpOnNoShow')::boolean, false) as followup
    from public.appointments a
    join public.clinics c on c.id = a.clinic_id
    join public.patients p on p.id = a.patient_id
    where a.status = 'קבוע'
      and coalesce((c.settings->>'autoNoShow')::boolean, false)
      and a.start + make_interval(mins => coalesce((c.settings->>'noShowMinutes')::int, 15)) <= now()
      and a.start >= now() - interval '2 hours'  -- only freshly-missed; don't sweep old history
  loop
    update public.appointments set status = 'לא הגיע' where id = r.id;
    if r.followup then
      insert into public.tasks (clinic_id, title, patient_id, assignee_id, source_at, due, status, source, note)
      values (r.clinic_id, 'פולו-אפ אי-הגעה — ' || r.pname, r.patient_id, r.therapist_id,
              r.start, now() + interval '3 hours', 'פתוח', 'אוטומציה',
              'נוצר אוטומטית לאחר אי-הגעה. ליצור קשר ולתאם מחדש.');
    end if;
  end loop;
end $$;

-- --- Reminder sweep: mark appointments due within reminderHours; dispatch if a
--     service key is stored in Vault (name 'edge_service_key'). reminder_sent_at
--     guards against re-sending. ---
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
      and a.start <= now() + make_interval(hours => coalesce((c.settings->>'reminderHours')::int, 24))
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

-- Automation only — never exposed to clients.
revoke all on function app.auto_no_show() from public, anon, authenticated;
revoke all on function app.queue_reminders() from public, anon, authenticated;

-- Schedules (cron.schedule upserts by name).
select cron.schedule('meditrack-auto-no-show', '*/5 * * * *',  $$ select app.auto_no_show(); $$);
select cron.schedule('meditrack-reminders',    '*/15 * * * *', $$ select app.queue_reminders(); $$);
