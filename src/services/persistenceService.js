// ─── PERSISTENCE SERVICE ──────────────────────────────────────────
// Centralizes all localStorage reads and writes.
// All keys are versioned to allow clean migration when schema changes.
// All reads are wrapped in try/catch — malformed data falls back to null.

const KEY_PREFIX = 'careplan_v1_'

const KEYS = {
  patientState:   KEY_PREFIX + 'patientState',
  timeline:       KEY_PREFIX + 'timeline',
  userDecisions:  KEY_PREFIX + 'userDecisions',
  medications:    KEY_PREFIX + 'medications',
  chatDrafts:     KEY_PREFIX + 'chatDrafts',
}

// ─── SCHEMA VERSION GUARD ─────────────────────────────────────────
// Bump SCHEMA_VERSION whenever the persisted data shape changes. On load, if the stored version
// doesn't match, all persisted state is discarded so the app starts fresh (onboarding) instead of
// hydrating a stale/incompatible timeline — which otherwise renders as a broken home feed. Runs
// once on import, before any load below.
const SCHEMA_VERSION = '2'
const VERSION_KEY = KEY_PREFIX + 'schemaVersion'
;(() => {
  try {
    if (localStorage.getItem(VERSION_KEY) !== SCHEMA_VERSION) {
      Object.values(KEYS).forEach(key => localStorage.removeItem(key))
      localStorage.setItem(VERSION_KEY, SCHEMA_VERSION)
    }
  } catch (e) { /* localStorage unavailable — ignore */ }
})()

// ─── SAVE ─────────────────────────────────────────────────────────

export const savePatientState = (patientState) => {
  try {
    localStorage.setItem(KEYS.patientState, JSON.stringify(patientState))
  } catch (e) {
    console.warn('[persistence] Failed to save patientState:', e)
  }
}

export const saveTimeline = (timeline) => {
  try {
    // Strip derived suggested blocks before saving — they are re-derived at runtime
    const clean = timeline.map(day => ({ ...day, suggested: null }))
    localStorage.setItem(KEYS.timeline, JSON.stringify(clean))
  } catch (e) {
    console.warn('[persistence] Failed to save timeline:', e)
  }
}

export const saveUserDecisions = (userDecisions) => {
  try {
    localStorage.setItem(KEYS.userDecisions, JSON.stringify(userDecisions))
  } catch (e) {
    console.warn('[persistence] Failed to save userDecisions:', e)
  }
}

// ─── LOAD ─────────────────────────────────────────────────────────

export const loadPatientState = () => {
  try {
    const raw = localStorage.getItem(KEYS.patientState)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Validate shape — must have at minimum diagnosisCode and stage
    if (!parsed || typeof parsed.diagnosisCode !== 'string' || typeof parsed.stage !== 'string') return null
    return parsed
  } catch (e) {
    console.warn('[persistence] Failed to load patientState:', e)
    return null
  }
}

export const loadTimeline = () => {
  try {
    const raw = localStorage.getItem(KEYS.timeline)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    // Recalculate isToday on every load so the flag always reflects the current date.
    // A daily summary lives only on Today — clear it from any day that is no longer today
    // (e.g. yesterday's Today node after a reload) so past days never carry a summary.
    const todayStr = new Date().toISOString().split('T')[0]
    return parsed.map(day => {
      const isToday = day.date === todayStr
      return { ...day, isToday, summary: isToday ? day.summary : null }
    })
  } catch (e) {
    console.warn('[persistence] Failed to load timeline:', e)
    return null
  }
}

export const loadUserDecisions = () => {
  try {
    const raw = localStorage.getItem(KEYS.userDecisions)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch (e) {
    console.warn('[persistence] Failed to load userDecisions:', e)
    return null
  }
}

export const saveMedications = (medications) => {
  try {
    localStorage.setItem(KEYS.medications, JSON.stringify(medications))
  } catch (e) {
    console.warn('[persistence] Failed to save medications:', e)
  }
}

export const loadMedications = () => {
  try {
    const raw = localStorage.getItem(KEYS.medications)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (e) {
    console.warn('[persistence] Failed to load medications:', e)
    return []
  }
}

// ─── CHAT DRAFTS ──────────────────────────────────────────────────
// Unsent composer text, kept per conversation (keyed by conversation id) so it survives
// navigating away and reloads — matching messaging-app behavior. Cleared on send.

const loadChatDrafts = () => {
  try {
    const raw = localStorage.getItem(KEYS.chatDrafts)
    const parsed = raw ? JSON.parse(raw) : null
    return (parsed && typeof parsed === 'object') ? parsed : {}
  } catch (e) { return {} }
}

export const getChatDraft = (id) => {
  if (!id) return ''
  const d = loadChatDrafts()
  return typeof d[id] === 'string' ? d[id] : ''
}

export const saveChatDraft = (id, text) => {
  if (!id) return
  try {
    const d = loadChatDrafts()
    if (text && text.trim()) d[id] = text
    else delete d[id]
    localStorage.setItem(KEYS.chatDrafts, JSON.stringify(d))
  } catch (e) { console.warn('[persistence] Failed to save chat draft:', e) }
}

// ─── CLEAR ────────────────────────────────────────────────────────
// Wipes all persisted state — useful for testing or a "reset" feature.

export const clearPersistedState = () => {
  try {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key))
  } catch (e) {
    console.warn('[persistence] Failed to clear state:', e)
  }
}

// ─── HYDRATE ──────────────────────────────────────────────────────
// Loads all three values at once. Returns defaults for any missing/malformed entry.
// Call once on app startup to get initial state.

export const hydrateState = (defaults) => {
  return {
    patientState:  loadPatientState()  ?? defaults.patientState,
    timeline:      loadTimeline()      ?? defaults.timeline,
    userDecisions: loadUserDecisions() ?? defaults.userDecisions,
  }
}
