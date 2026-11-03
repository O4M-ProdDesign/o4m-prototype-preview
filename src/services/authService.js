// ─── AUTH SERVICE ─────────────────────────────────────────────────
// Prototype-only authentication. No backend, no API.
// Accounts are stored in memory (lost on hard reload).
// Session is stored in localStorage so it survives reloads (including the dev
// day-rollover reload and artifact-iframe reloads, where sessionStorage can drop).

const SESSION_KEY = 'careplan_session'

// Seeded demo accounts for returning-user testing
const SEEDED_ACCOUNTS = [
  { name: 'Nick S',    email: 'nick@demo.com',    password: 'demo1234' },
  { name: 'Maria S',   email: 'maria@demo.com',   password: 'demo1234' },
  { name: 'James T',   email: 'james@demo.com',   password: 'demo1234' },
]

// In-memory store — accounts created at runtime are added here
let accounts = [...SEEDED_ACCOUNTS]

// ─── SESSION ──────────────────────────────────────────────────────

export const loadSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

const saveSession = (user) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } catch {}
}

export const clearSession = () => {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}

// ─── AUTH OPERATIONS ──────────────────────────────────────────────

// Returns { ok: true, user } or { ok: false, error }
export const login = (email, password) => {
  const e = email.trim().toLowerCase()
  const account = accounts.find(a => a.email.toLowerCase() === e)
  if (!account) return { ok: false, error: 'No account found with that email.' }
  if (account.password !== password) return { ok: false, error: 'Incorrect password.' }
  const user = { name: account.name, email: account.email }
  saveSession(user)
  return { ok: true, user }
}

// Returns { ok: true, user } or { ok: false, error }
export const createAccount = (name, email, password) => {
  const n = name.trim()
  const e = email.trim().toLowerCase()
  if (!n) return { ok: false, error: 'Please enter your name.' }
  if (!e || !e.includes('@')) return { ok: false, error: 'Please enter a valid email address.' }
  if (!password || password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
  if (accounts.find(a => a.email.toLowerCase() === e)) {
    return { ok: false, error: 'An account with that email already exists.' }
  }
  const account = { name: n, email: e, password }
  accounts.push(account)
  const user = { name: n, email: e }
  saveSession(user)
  return { ok: true, user }
}

// Onboarding sign-up (redesign-04). Credentials are chosen first (email or a provider),
// then name + date of birth are captured on the "About you" step, and the account is created
// with everything at once. provider: 'email' | 'apple' | 'google' (Apple/Google simulated).
export const checkEmailAvailable = (email = '') => {
  const e = email.trim().toLowerCase()
  if (!e || !e.includes('@')) return { ok: false, error: 'Please enter a valid email address.' }
  if (accounts.find(a => a.email.toLowerCase() === e)) return { ok: false, error: 'An account with that email already exists.' }
  return { ok: true }
}

export const createOnboardingAccount = ({ provider = 'email', email = '', password = '', firstName = '', lastName = '', birthDate = '' } = {}) => {
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
  if (!firstName.trim()) return { ok: false, error: 'Please enter your first name.' }
  if (!lastName.trim()) return { ok: false, error: 'Please enter your last name.' }
  // birthDate is the account holder's own (for a caregiver, the patient's lives on the record).
  if (!birthDate) return { ok: false, error: 'Please add your date of birth.' }
  let e = email.trim().toLowerCase()
  if (provider === 'email') {
    const avail = checkEmailAvailable(e)
    if (!avail.ok) return avail
    if (!password || password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    accounts.push({ name, email: e, password, birthDate })
  } else {
    e = provider === 'apple' ? 'private@privaterelay.appleid.com' : 'you@gmail.com'
  }
  const user = { name, email: e, provider, birthDate }
  saveSession(user)
  return { ok: true, user }
}

export const logout = () => {
  clearSession()
}

// Hint for demo purposes
export const getDemoHint = () => `Try nick@demo.com / demo1234`
