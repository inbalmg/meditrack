-- MediTrack — Migration 39: request escalation status ("Needs Human") for the AI agent.
-- Stage 4 adds an AI front-desk agent (n8n) that handles the "צריכים עזרה או מידע נוסף?"
-- inquiry path. When the agent hits a guardrail (angry patient, discount/refund, medical
-- emergency, out-of-scope), it escalates: the inquiry's status flips to 'דרוש טיפול אנושי'
-- (Needs Human) and an escalation_reason is recorded. The secretary board surfaces these
-- next to the 'ממתין' inquiries with an escalation badge, and resolves them normally
-- (mark handled / convert to task). A DB trigger (migration 41) fires a Telegram alert on
-- this exact transition.
--
-- 'דרוש טיפול אנושי' is a human-attention state (a sibling of 'ממתין'), not a terminal one —
-- it is removed from the board only by the same two terminal outcomes as any inquiry.

alter table public.requests drop constraint requests_status_check;
alter table public.requests
  add constraint requests_status_check
  check (status in ('ממתין', 'אושר', 'נדחה', 'נוצר קשר', 'סגור', 'הומר למשימה', 'דרוש טיפול אנושי'));

-- Why the agent escalated (free text, Hebrew). Patient-invisible, like staff_note — it is
-- operational context for the secretary, distinct from rejection_reason (which the patient sees).
alter table public.requests add column if not exists escalation_reason text;
