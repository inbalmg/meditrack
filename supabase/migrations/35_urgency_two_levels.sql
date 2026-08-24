-- MediTrack — Migration 35: collapse urgency to two levels (רגיל / דחוף).
-- The middle level 'בהקדם' is removed everywhere. Existing rows carrying it are folded up
-- to 'דחוף' (it was the elevated-urgency level, so it keeps its flag), then the CHECK on
-- both requests.urgency and tasks.urgency is tightened to just ('רגיל','דחוף').
update public.requests set urgency = 'דחוף' where urgency = 'בהקדם';
update public.tasks    set urgency = 'דחוף' where urgency = 'בהקדם';

alter table public.requests drop constraint if exists requests_urgency_check;
alter table public.requests
  add constraint requests_urgency_check
  check (urgency is null or urgency in ('רגיל','דחוף'));

alter table public.tasks drop constraint if exists tasks_urgency_check;
alter table public.tasks
  add constraint tasks_urgency_check
  check (urgency is null or urgency in ('רגיל','דחוף'));
