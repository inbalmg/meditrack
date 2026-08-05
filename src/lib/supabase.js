import { createClient } from '@supabase/supabase-js'

// לקוח Supabase יחיד לכל האפליקציה. הערכים מגיעים מ-.env (ראו .env.example);
// המפתח הוא ה-publishable/anon בלבד — מפתחות סוד נשארים בשרת (Edge Functions).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. העתיקו את .env.example ל-.env ומלאו את הערכים מפרויקט Supabase.',
  )
}

// persistSession + autoRefreshToken: שומרים את הסשן המאומת בין רענונים (רלוונטי
// כשמחליפים את ה-login הידני ב-Supabase Auth בשלב 4). detectSessionInUrl: תומך
// בזרימות magic-link / OTP חוזרות.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
