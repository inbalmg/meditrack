-- MediTrack — Migration 41: Telegram alert when an inquiry is escalated to "Needs Human".
-- Decoupled from the agent flow: ANY transition of requests.status into 'דרוש טיפול אנושי'
-- (the agent's escalate RPC, or a manual change) fires one outbound webhook to n8n, which
-- sends the Telegram message. This is the "status change → notification" wiring Stage 4 asks
-- for. Reuses the pg_net http_post pattern from migration 07; requests already ships the OLD
-- row image on UPDATE (replica identity full, migration 30) so OLD.status is available.
--
-- The n8n webhook URL is read from Vault (secret name 'n8n_escalation_webhook') at runtime,
-- so this migration is safe to deploy before the n8n workflow exists: with no secret the
-- function is a no-op. Set it later with:
--   select vault.create_secret('<n8n webhook url>', 'n8n_escalation_webhook');

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
          'patientName',      (select name from public.patients where id = NEW.patient_id)
        )
      );
    end if;
  end if;
  return NEW;
end $$;

-- Trigger-only helper — never called directly by a client.
revoke all on function app.notify_escalation() from public, anon, authenticated;

drop trigger if exists trg_notify_escalation on public.requests;
create trigger trg_notify_escalation
  after update on public.requests
  for each row execute function app.notify_escalation();
