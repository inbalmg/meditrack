-- MediTrack — Migration 26: request rejection reason + updated_at.
--   rejection_reason : staff-provided note shown to the patient when a request is
--                      rejected ('נדחה'). Nullable — a reason is optional.
--   updated_at       : last-change timestamp. Drives the patient dashboard's status
--                      banner window (shown only while updated within the last 7 days),
--                      so the 7-day clock starts from the rejection/approval, not from
--                      when the request was first created. Backfilled to created_at for
--                      existing rows, then kept fresh by a BEFORE UPDATE trigger.
alter table public.requests add column rejection_reason text;
alter table public.requests add column updated_at timestamptz;
update public.requests set updated_at = created_at;
alter table public.requests
  alter column updated_at set not null,
  alter column updated_at set default now();

create or replace function app.requests_touch_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists requests_set_updated_at on public.requests;
create trigger requests_set_updated_at
  before update on public.requests
  for each row execute function app.requests_touch_updated_at();
