-- Patients: store year of birth; age is derived at read time (in the app) so it
-- never goes stale. Existing rows are backfilled from their previous static `age`
-- using the reference year 2026, so displayed ages stay identical. The legacy
-- `age` column is kept for backward compatibility (the app still writes a derived
-- value into it), but `birth_year` is the source of truth going forward.
alter table public.patients add column if not exists birth_year int;

update public.patients
   set birth_year = 2026 - age
 where birth_year is null
   and age is not null;
