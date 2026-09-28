-- MediTrack — Stage 4: isolated test tenant for the n8n AI agent QA.
-- ADDITIVE and REMOVABLE. Creates a dedicated clinic + patient so every inquiry the agent
-- writes (create_inquiry / escalate_to_human) lands in a separate tenant. RLS scopes the
-- deployed app to the real clinic (3e78d4b9-…), so these rows are NEVER visible in the app
-- — "no trace of the agent" while the instructor reviews the previous task on Deployed.
--
-- The agent's READ tools (get_clinic_info / list_treatments) keep pointing at the real
-- clinic (read-only, no trace); only WRITES are isolated here. Idempotent (ON CONFLICT).
--
-- Cleanup when done:
--   delete from public.requests  where clinic_id = 'aaaaaaaa-0000-4000-8000-000000000001';
--   delete from public.patients  where clinic_id = 'aaaaaaaa-0000-4000-8000-000000000001';
--   delete from public.clinics   where id        = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.clinics (id, name, settings)
select 'aaaaaaaa-0000-4000-8000-000000000001', 'בדיקת סוכן AI (QA)', settings
from public.clinics where id = '3e78d4b9-1dcc-4f25-a9b2-f472f5f7aab0'
on conflict (id) do nothing;

insert into public.patients (id, clinic_id, name, phone, birth_year, gender, notify_opt_in, profile_id)
values ('aaaaaaaa-0000-4000-8000-000000000002',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'דניאל אבני', '054-7712389', 1990, 'other', false, null)
on conflict (id) do nothing;
