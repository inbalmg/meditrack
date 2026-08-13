-- MediTrack — Migration 18: required patient fields + gender enum, drop redundant age.
--   phone       : NOT NULL (reminder channel)
--   birth_year  : NOT NULL + sane range; replaces the derived `age` column
--   gender      : NOT NULL + CHECK ('male','female','other')
-- Backfill legacy gender (Hebrew ז/נ; NULL/'') to the canonical values first so the
-- NOT NULL + CHECK can be applied to existing rows. `age` is derived in the app
-- (currentYear − birth_year), so it is dropped here — the DB keeps only birth_year.

update public.patients set gender = case
  when gender = 'ז' then 'male'
  when gender = 'נ' then 'female'
  when gender in ('male', 'female', 'other') then gender
  else 'other'
end;

alter table public.patients
  alter column phone set not null,
  alter column birth_year set not null,
  alter column gender set not null;

alter table public.patients
  add constraint patients_gender_check check (gender in ('male', 'female', 'other')),
  add constraint patients_birth_year_check check (birth_year between 1900 and 2100);

alter table public.patients drop column age;
