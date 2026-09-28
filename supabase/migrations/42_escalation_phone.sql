-- MediTrack — Migration 42: add the patient's phone to the escalation webhook payload.
-- Additive + backward-compatible: CREATE OR REPLACE of app.notify_escalation() (migration 41),
-- adding 'patientPhone' so the manager can call the patient directly from the Telegram alert
-- without having to look the inquiry up in the system. The trigger (trg_notify_escalation)
-- already references this function by name, so no trigger change is needed.

create or replace function app.notify_escalation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare hook text;
begin
  if NEW.status = 'דרוש טיפול אנושי' and NEW.status is distinct from OLD.status then
    select decrypted_secret into hook
      from vault.decrypted_secrets where name = 'n8n_escalation_webhook' limit 1;
    if hook is not null then
      perform net.http_post(
        url     := hook,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'requestId',        NEW.id,
          'clinicId',         NEW.clinic_id,
          'subject',          NEW.subject,
          'escalationReason', NEW.escalation_reason,
          'patientName',      (select name  from public.patients where id = NEW.patient_id),
          'patientPhone',     (select phone from public.patients where id = NEW.patient_id)
        )
      );
    end if;
  end if;
  return NEW;
end $$;

revoke all on function app.notify_escalation() from public, anon, authenticated;
