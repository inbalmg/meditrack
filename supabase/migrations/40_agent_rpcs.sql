-- MediTrack — Migration 40: least-privilege RPCs for the AI front-desk agent (n8n).
-- The agent's two write actions go through these SECURITY DEFINER functions instead of a
-- broad table-write grant, so the write surface is exactly two well-defined operations and
-- the shape (kind/source/status/allowed columns) is enforced in the DB — a prompt-injected
-- agent cannot craft an arbitrary INSERT/UPDATE. n8n holds a server-side key (service_role,
-- as in Stage 3) and calls only these RPCs for writes; reads (treatments/clinic) are plain
-- selects. EXECUTE is revoked from public/anon/authenticated and granted to service_role only.
--
-- Reuses the existing requests/inquiry model (migrations 27/28/34): an inquiry is a request
-- with kind='inquiry', source='פורטל', status='ממתין'. No new table, no duplicated lifecycle.

-- NOTE: these live in the PUBLIC schema (not app) because PostgREST only exposes public
-- via /rest/v1/rpc — n8n calls them over PostgREST. (The app schema is not API-exposed.)

-- ── agent_create_inquiry: open a portal inquiry in the secretary queue ──────────────────
-- clinic_id is derived from the patient row (also validates the patient exists), so the
-- caller cannot target another clinic. Returns the new request id.
create or replace function public.agent_create_inquiry(
  p_patient_id uuid,
  p_subject    text,
  p_description text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_clinic uuid;
  v_id     uuid;
begin
  if p_subject is null or btrim(p_subject) = '' then
    raise exception 'subject is required';
  end if;

  select clinic_id into v_clinic from public.patients where id = p_patient_id;
  if v_clinic is null then
    raise exception 'unknown patient %', p_patient_id;
  end if;

  insert into public.requests (clinic_id, patient_id, kind, source, status, subject, description)
  values (v_clinic, p_patient_id, 'inquiry', 'פורטל', 'ממתין',
          btrim(p_subject), nullif(btrim(coalesce(p_description, '')), ''))
  returning id into v_id;

  return v_id;
end $$;

-- ── agent_escalate_inquiry: flip an inquiry to "Needs Human" + record why ───────────────
-- Touches ONLY status / escalation_reason / staff_note (+ updated_at). Guards that the row
-- exists and is an inquiry. The status flip to 'דרוש טיפול אנושי' is what fires the Telegram
-- alert trigger (migration 41).
create or replace function public.agent_escalate_inquiry(
  p_request_id uuid,
  p_reason     text,
  p_note       text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason is required';
  end if;

  select kind into v_kind from public.requests where id = p_request_id;
  if v_kind is null then
    raise exception 'unknown request %', p_request_id;
  end if;
  if v_kind <> 'inquiry' then
    raise exception 'request % is not an inquiry', p_request_id;
  end if;

  update public.requests
     set status            = 'דרוש טיפול אנושי',
         escalation_reason = btrim(p_reason),
         staff_note        = coalesce(nullif(btrim(coalesce(p_note, '')), ''), staff_note),
         updated_at        = now()
   where id = p_request_id;
end $$;

-- Least privilege: only a server-side service_role caller may invoke these.
revoke all on function public.agent_create_inquiry(uuid, text, text)  from public;
revoke all on function public.agent_escalate_inquiry(uuid, text, text) from public;
grant execute on function public.agent_create_inquiry(uuid, text, text)  to service_role;
grant execute on function public.agent_escalate_inquiry(uuid, text, text) to service_role;
