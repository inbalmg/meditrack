-- MediTrack — Migration 33: retire the AI booking-request path.
-- Phone calls no longer enter the requests queue for AI classification — the secretary
-- either books directly (appointments) or escalates to a task. That removed the only
-- writer/reader of requests.ai, so the column is now dead. The `requests` table keeps
-- serving human inquiries (kind='inquiry') from the patient portal only.
--
-- Kept intentionally: the `kind` column + CHECK (inquiries still set kind='inquiry'; the
-- 'booking' default is simply unused now) and the widened status CHECK (the legacy 'אושר'
-- value stays valid — no booking rows are created, so no data migration is required).
alter table public.requests drop column if exists ai;
