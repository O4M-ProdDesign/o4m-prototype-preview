// ─── AUTH SERVICE ─────────────────────────────────────────────────
// Prototype-only authentication. No backend, no API.
// Accounts are stored in memory (lost on hard reload).
// Session is stored in sessionStorage (survives refresh, clears on tab close).

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
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

const saveSession = (user) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } catch {}
}

export const clearSession = () => {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
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

export const logout = () => {
  clearSession()
}

// Hint for demo purposes
export const getDemoHint = () => `Try nick@demo.com / demo1234`
