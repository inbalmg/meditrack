// Shared vocabulary for the secretary "escalation" task flow (category + urgency).
// Used by EscalationDialog (input) and TasksBoard (display/edit), so the option lists and
// the urgency→badge-tone mapping live in one place.

// Urgency levels (Hebrew): two only — normal + urgent (migration 35 removed the middle
// 'בהקדם'). Matches the DB CHECK on requests.urgency / tasks.urgency.
export const URGENCY_OPTIONS = ['דחוף', 'רגיל']

// Badge tone per urgency (tones defined in components/ui.jsx Badge).
export const URGENCY_TONE = { 'דחוף': 'red', 'רגיל': 'slate' }

// Sort weight (lower = more urgent) for ordering the task board.
export const URGENCY_WEIGHT = { 'דחוף': 0, 'רגיל': 1 }

// Escalation categories offered as a chip set. Free text in the DB so this can evolve.
export const CATEGORY_OPTIONS = ['אדמיניסטרציה', 'תיאום מטפל', 'רפואי', 'אחר']
