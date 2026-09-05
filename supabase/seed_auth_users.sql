-- MediTrack — fixed TEST users (demo only). Email+password for deterministic login.
-- app_metadata carries clinic_id + role → the on_auth_user_created trigger creates
-- the matching profiles row → RLS scopes their data. Therapist/patient are linked to
-- existing domain rows (רועי / רותם) so their portals show real data after step 6.
--
--   Admin/manager : manager@meditrack.test   / Meditrack1!
--   Secretary     : secretary@meditrack.test / Meditrack1!
--   Therapist     : therapist@meditrack.test / Meditrack1!   (→ רועי שקד)
--   Patient       : patient@meditrack.test   / Meditrack1!   (→ רותם ברק)
--   New patient    : newpatient@meditrack.test / Meditrack1! (role=patient, NO patients
--                    row → currentPatientId=null → first-time self-booking flow)
--
-- NOTE: production patient login = phone OTP; email+password here is only to make the
-- patient account testable deterministically. Passwords are bcrypt-hashed via pgcrypto.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000',
   '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'manager@meditrack.test',
   extensions.crypt('Meditrack1!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"clinic_id":"3e78d4b9-1dcc-4f25-a9b2-f472f5f7aab0","role":"manager"}',
   '{"full_name":"נעמה שקד"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '40000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'secretary@meditrack.test',
   extensions.crypt('Meditrack1!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"clinic_id":"3e78d4b9-1dcc-4f25-a9b2-f472f5f7aab0","role":"secretary"}',
   '{"full_name":"רונית לוי"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'therapist@meditrack.test',
   extensions.crypt('Meditrack1!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"clinic_id":"3e78d4b9-1dcc-4f25-a9b2-f472f5f7aab0","role":"therapist"}',
   '{"full_name":"רועי שקד"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'patient@meditrack.test',
   extensions.crypt('Meditrack1!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"clinic_id":"3e78d4b9-1dcc-4f25-a9b2-f472f5f7aab0","role":"patient"}',
   '{"full_name":"רותם ברק"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '50000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'newpatient@meditrack.test',
   extensions.crypt('Meditrack1!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"clinic_id":"3e78d4b9-1dcc-4f25-a9b2-f472f5f7aab0","role":"patient"}',
   '{"full_name":"מטופל/ת חדש/ה"}', now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

-- NOTE: newpatient@ is deliberately NOT linked to any public.patients row — it models a
-- brand-new patient whose record is created only when they finish their first booking.

-- Link the therapist/patient auth users to their existing domain rows.
update public.therapists set profile_id = '20000000-0000-0000-0000-000000000002'
  where id = '921306c6-cc04-41d5-a160-01a782871afd';       -- רועי שקד
update public.patients   set profile_id = '30000000-0000-0000-0000-000000000003'
  where id = '33872bf9-6423-49e0-a174-265b5a39cbd9';       -- רותם ברק
