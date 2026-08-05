import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { onAuthStateChange, claimsFromSession, signOut as authSignOut } from './lib/auth.js'

// The clinic staff roles (from the permissions matrix in the spec). The role object
// shape is unchanged — components read role.id / canReports / canApprove /
// scopeAllTherapists / therapistId / home exactly as before. Only the SOURCE changed:
// the role now comes from the authenticated JWT (app_metadata.role), not a manual pick.
export const ROLES = {
  secretary: {
    id: 'secretary',
    label: 'מזכירות',
    desc: 'ניהול צינור הבקשות, יומן ומשימות',
    home: '/clinic',
    canReports: false,
    canApprove: true,
    canSettings: true,
    scopeAllTherapists: true,
  },
  therapist: {
    id: 'therapist',
    label: 'רופא / מטפל',
    desc: 'צפייה ביומן ובמשימות שלי בלבד',
    home: '/doctor',
    canReports: false,
    canApprove: false,
    scopeAllTherapists: false,
    // therapistId is filled in at login from the therapist row linked to this user.
  },
  manager: {
    id: 'manager',
    label: 'מנהל/ת קליניקה',
    desc: 'גישה מלאה + דוחות ואנליטיקה',
    home: '/clinic',
    canReports: true,
    canApprove: true,
    canSettings: true,
    scopeAllTherapists: true,
  },
  patient: {
    id: 'patient',
    label: 'מטופל',
    desc: 'בקשת תור ומעקב',
    home: '/patient',
    isPatient: true,
  },
}

const SessionContext = createContext(null)

// Build the augmented role object from JWT claims. For a therapist we resolve their
// therapist-row id (role.therapistId) so the doctor screens filter to their own data.
async function roleFromClaims(claims) {
  const base = ROLES[claims.role]
  if (!base) return null
  if (claims.role === 'therapist') {
    const { data } = await supabase
      .from('therapists')
      .select('id')
      .eq('profile_id', claims.userId)
      .maybeSingle()
    return { ...base, therapistId: data?.id ?? null }
  }
  return base
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'authed' | 'anon'

  useEffect(() => {
    let active = true
    async function apply(s) {
      if (!active) return
      setSession(s)
      if (!s) { setRole(null); setStatus('anon'); return }
      const claims = claimsFromSession(s)
      const r = await roleFromClaims(claims)
      if (!active) return
      setRole(r)
      setStatus(r ? 'authed' : 'anon')
    }
    // Restore an existing session on load, then subscribe to changes.
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const unsub = onAuthStateChange((s) => apply(s))
    return () => { active = false; unsub() }
  }, [])

  const claims = claimsFromSession(session)

  async function logout() {
    await authSignOut()
  }

  return (
    <SessionContext.Provider
      value={{ session, role, status, userId: claims.userId, clinicId: claims.clinicId, login: undefined, logout }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
