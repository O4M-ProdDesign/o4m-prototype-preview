import { Fragment, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react'
import ReactDOM from 'react-dom'
import { findCoveringRule, findRuleMatchingItem, findMatchingRules, wouldImpactRecommendations, getImpactContext, isCancerSupported } from './services/recommendationService.js'
import { hydrateState, savePatientState, saveTimeline, saveUserDecisions, clearPersistedState, saveMedications, loadMedications, getChatDraft, saveChatDraft, saveSymptoms, loadSymptoms, saveDoseLogs, loadDoseLogs, saveJournal, loadJournal, savePending, loadPending, saveQuestions, loadQuestions, saveAiDismissed, loadAiDismissed, saveMood, loadMood, saveSymptomNone, loadSymptomNone } from './services/persistenceService.js'
import { loadSession, login, createAccount, createOnboardingAccount, checkEmailAvailable, logout } from './services/authService.js'
import { useRecommendations } from './hooks/useRecommendations.js'
import { COMMUNITIES, COMMUNITY_POSTS, POST_COMMENTS } from './data/communityData.js'
// Brand logo (mark + wordmark), inlined as a data URI so the single-file build carries it.
import outcomesLogoSvg from './assets/outcomes-logo.svg?raw'
const OUTCOMES_LOGO_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(outcomesLogoSvg)}`
import { careSubject, careName, fillCopy, RELATIONSHIPS, cap as _cap, possessive as _possessive } from './services/patientCopy.js'
import { IMG_FDA_LAB, IMG_SPONSORED_THERAPY, IMG_WEBINAR_FUH, IMG_WEBINAR_LENZ } from './data/todayImages.js'
import { getDetailData, getRegimenData } from './services/treatmentService.js'
import { getProcedureCatalog, getProcedureSuggested, getScanCatalog, getScanSuggested, getMedicationCatalog, getMedicationSuggested, searchCatalog } from './services/catalogService.js'

// ─── FLYOUT SINGLETON — one open at a time ────────────────────────
// Module-level ref to the currently open menu's close function.
// Calling it before opening a new menu enforces one-at-a-time.
let _closeActiveMenu = null

// ─── DESIGN TOKENS ────────────────────────────────────────────────
const C = {
  primary: '#ff7958',
  primaryLight: '#faeae9',
  bgApp: '#F5F4F6',
  bgCard: '#ffffff',
  textPrimary: 'rgba(0,0,0,0.87)',
  textSecondary: 'rgba(0,0,0,0.55)',
  textTertiary: 'rgba(0,0,0,0.35)',
  textIcon: '#414652',
  iconFill: '#414652',
  border: 'rgba(0,0,0,0.10)',
  borderMid: 'rgba(0,0,0,0.14)',
  timelineLine: '#DFDEE0',
  timelineLineToday: '#ffb8a6',
}

// v3.20: no special AI styling. The sparkle takes the color its button's hierarchy calls for:
// orange in secondaries, tertiaries and the floating Chat button (white on a filled primary), and
// orange where it stands alone as the AI mark.
const AI_ICON = { color: '#FF7958' }

// ─── UTILS ────────────────────────────────────────────────────────
// Always use local calendar date (avoids UTC-offset "yesterday" bug from toISOString)
let _DEV_DAY_OFFSET = 0
try { _DEV_DAY_OFFSET = parseInt(localStorage.getItem('o4m_dev_day_offset') || '0', 10) || 0 } catch (e) {}
const localDateStr = (d) => {
  let base = d
  if (!base) { base = new Date(); if (_DEV_DAY_OFFSET) base.setDate(base.getDate() + _DEV_DAY_OFFSET) }
  return `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`
}

// ─── DATA ─────────────────────────────────────────────────────────
const INITIAL_TIMELINE = (() => {
  const daysAgo = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d)
  }
  const label = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  }
  const today = daysAgo(0), d1 = daysAgo(6), d2 = daysAgo(3)
  return [
    {
      date: d1, label: label(6), isToday: false,
      summary: null,
      events: [
        { id: 'e1', type: 'procedure', name: 'Partial nephrectomy (surgery)', date: d1, notes: 'Right kidney. Laparoscopic approach. Margins clear. Estimated blood loss 150mL.' },
        { id: 'e2', type: 'scan', name: 'CT Abdomen and Pelvis', date: d1, notes: '3.2cm right renal mass. No evidence of nodal involvement or distant metastasis.' },
      ],
      suggested: null,
    },
    {
      date: d2, label: label(3), isToday: false,
      summary: null,
      events: [
        { id: 'e3', type: 'scan', name: 'Post-operative CT Chest', date: d2, notes: 'No pulmonary metastases. Surgical site healing well.' },
        { id: 'e4', type: 'procedure', name: 'Pathology review', date: d2, notes: 'Clear cell RCC, Grade 2. pT1bN0M0. Margins negative.' },
      ],
      suggested: null,
    },
    {
      date: today, label: label(0), isToday: true,
      summary: null,
      events: [
        { id: 'e5', type: 'procedure', name: 'Oncology follow-up', date: today, notes: 'Discussed pathology results. Patient doing well post-op. Adjuvant options under discussion.' },
        { id: 'e6', type: 'scan', name: 'Renal function panel', date: today, notes: 'eGFR 68. Monitoring remaining kidney function post-nephrectomy.' },
      ],
      suggested: null,
    },
  ]
})()

// Reconcile a (possibly persisted-from-an-earlier-day) timeline to the real current
// date: recompute isToday against today, and guarantee a Today node exists. Without
// this, state saved on a prior day keeps isToday on a stale date and the real Today
// disappears on reload (summary/recs/scroll all key off the isToday node).
const reconcileToday = (timeline) => {
  const todayStr = localDateStr()
  let hasToday = false
  const mapped = (timeline || []).map(d => {
    const isT = d.date === todayStr
    if (isT) hasToday = true
    return d.isToday === isT ? d : { ...d, isToday: isT }
  })
  if (!hasToday) {
    const d = new Date(todayStr + 'T12:00:00')
    mapped.push({ date: todayStr, label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }), isToday: true, summary: null, events: [], suggested: null })
    mapped.sort((a, b) => a.date.localeCompare(b.date))
  }
  return mapped
}

// ─── PATIENT STATE ────────────────────────────────────────────────
// PATIENT_STATE is now React state in App() — see useState(INITIAL_PATIENT_STATE)

// ─── RECOMMENDATION RULES ─────────────────────────────────────────
// Each rule has:
//   id         — stable string, never changes (used as recommendation ID)
//   group      — which SuggestedBlock it belongs to
//   groupLabel — display label for the block
//   groupBody  — description text for the block
//   title      — option title shown in the list
//   description — option description
//   type       — 'medication' | 'procedure' | 'scan'
//   condition  — pure function(patientState, planItems) → boolean

// ─── RECOMMENDATION ENGINE ────────────────────────────────────────
// Pure function — same inputs always produce same outputs
// Returns recommendation objects grouped for SuggestedBlock display
// deriveRecommendations moved to src/services/recommendationService.js

// Initial patient state — populated by onboarding, never mutated directly
const INITIAL_PATIENT_STATE = {
  diagnosisCode: 'RCC',
  stage: 'I',
  biomarkers: { histology: 'clear-cell' },
  performanceStatus: 0,  // ECOG 0
}

// ─── USER DECISIONS ───────────────────────────────────────────────
// Records of what the user has done with recommendations
// shape: { id, recommendationId, decision: 'accepted'|'dismissed', timestamp }
// Starts empty — populated as user acts on suggestions
const INITIAL_USER_DECISIONS = []

// ─── PROVIDER DATABASE ────────────────────────────────────────────
const PROVIDERS = [
  { name: 'Dr. Sarah Chen',      subtitle: 'Medical Oncologist',            searchTerms: ['sarah', 'chen', 'oncologist', 'medical oncologist', 'kidney', 'rcc'], location: '300 Longwood Ave Boston MA 02115',       avatar: 'SC' },
  { name: 'Dr. Michael Torres',  subtitle: 'Surgical Oncologist',           searchTerms: ['michael', 'torres', 'surgical', 'surgery', 'surgeon'],              location: '55 Fruit St Boston MA 02114',            avatar: 'MT' },
  { name: 'Dr. Amanda Park',     subtitle: 'Radiation Oncologist',          searchTerms: ['amanda', 'park', 'radiation', 'radiotherapy', 'sbrt'],              location: '1400 Pelham Pkwy S Bronx NY 10461',      avatar: 'AP' },
  { name: 'Dr. Lisa Nguyen',     subtitle: 'Hematologist',                  searchTerms: ['lisa', 'nguyen', 'hematologist', 'blood', 'hematology'],            location: '221 Longwood Ave Boston MA 02115',       avatar: 'LN' },
  { name: 'Dr. Robert Kim',      subtitle: 'Radiologist',                   searchTerms: ['robert', 'kim', 'radiologist', 'radiology', 'imaging'],             location: '75 Francis St Boston MA 02115',          avatar: 'RK' },
  { name: 'Dr. James Wilson',    subtitle: 'Palliative Care Specialist',    searchTerms: ['james', 'wilson', 'palliative', 'comfort', 'hospice'],              location: '',                                 avatar: 'JW' },
  { name: 'Dr. Emily Rodriguez', subtitle: 'Oncology Nurse Practitioner',   searchTerms: ['emily', 'rodriguez', 'nurse', 'np', 'practitioner'],               location: '300 Longwood Ave Boston MA 02115',       avatar: 'ER' },
  { name: 'Dr. David Patel',     subtitle: 'Oncology Pharmacist',           searchTerms: ['david', 'patel', 'pharmacist', 'pharmacy', 'medication'],           location: '',                                 avatar: 'DP' },
  { name: 'Dr. Jennifer Lee',    subtitle: 'Clinical Nutritionist Oncology',searchTerms: ['jennifer', 'lee', 'nutritionist', 'dietitian', 'nutrition', 'diet'],location: '1 Medical Center Blvd Winston-Salem NC 27157',            avatar: 'JL' },
  { name: 'Dr. Marcus Brown',    subtitle: 'Pain Management Specialist',    searchTerms: ['marcus', 'brown', 'pain', 'management', 'analgesic'],               location: '500 University Ave Sacramento CA 95817',               avatar: 'MB' },
  { name: 'Dr. Aisha Johnson',   subtitle: 'Oncology Social Worker',        searchTerms: ['aisha', 'johnson', 'social', 'worker', 'support'],                 location: '',                                 avatar: 'AJ' },
]
const CARE_TEAM = PROVIDERS.slice(0, 3)
const APPOINTMENT_TYPES = ['In Office', 'Virtual', 'Phone Call', 'Lab Work', 'Imaging', 'Other']
const LOCATION_REQUIRED_TYPES = ['In Office', 'Lab Work', 'Imaging']

// ─── EXPERIMENTS ─────────────────────────────────────────────────
// Reversible variant switches. Each flag ships in the build, so eng/product
// can compare options without a rebuild. Defaults live here; override at
// runtime with a URL param, e.g.  ?exp=addressLookup:off  (comma-separate
// multiple:  ?exp=addressLookup:off,foo:v2 ). Prune rejected flags so they
// don't accumulate in App.jsx.
const EXPERIMENT_DEFAULTS = {
  addressLookup: 'on',     // Location step street field — 'on' = autocomplete dropdown, 'off' = plain input
  engagementModal: 'on',   // 'on' = connect-records nudge after high-intent manual effort (see ENGAGEMENT_* rules)
  resourcesTab: 'on',      // 'on' = show the Resources tab in the bottom nav (default on)
}
// For reference / the in-app experiments panel: label + allowed values per flag.
const EXPERIMENT_META = {
  addressLookup: { label: 'Address lookup on Location step', values: ['on', 'off'] },
  engagementModal: { label: 'Engagement modal (2 manual events)', values: ['off', 'on'] },
  resourcesTab: { label: 'Resources tab (bottom nav)', values: ['on', 'off'] },
}
const EXP_LS_KEY = 'o4m_experiments'
const _readExpLS = () => { try { return JSON.parse(localStorage.getItem(EXP_LS_KEY) || '{}') } catch { return {} } }
const _expUrlOverrides = (() => {
  try {
    const raw = new URLSearchParams(window.location.search).get('exp')
    if (!raw) return {}
    return Object.fromEntries(raw.split(',').map(s => s.split(':').map(x => x.trim())).filter(a => a.length === 2 && a[0]))
  } catch { return {} }
})()
// Precedence: defaults ← in-app panel (localStorage) ← ?exp= URL param (wins, for eng).
const EXPERIMENTS = { ...EXPERIMENT_DEFAULTS, ..._readExpLS(), ..._expUrlOverrides }
const exp = (key) => EXPERIMENTS[key]
// Set from the in-app panel: persist, drop any ?exp= override, and reload so every exp() reflects it.
const setExperiment = (key, value) => {
  try { const cur = _readExpLS(); cur[key] = value; localStorage.setItem(EXP_LS_KEY, JSON.stringify(cur)) } catch {}
  try { const u = new URL(window.location.href); u.searchParams.delete('exp'); window.history.replaceState(null, '', u) } catch {}
  window.location.reload()
}
const resetExperiments = () => {
  try { localStorage.removeItem(EXP_LS_KEY) } catch {}
  try { localStorage.removeItem(ENGAGEMENT_KEY); localStorage.removeItem(RECORDS_CONNECTED_KEY) } catch {} // restart the nudge for testing
  window.location.reload()
}

// ─── ENGAGEMENT NUDGE (connect-records) ──────────────────────────
// Nudges the user to connect their medical records once they show high intent via manual effort.
// A "signal" = a manually saved event OR a "Leave without saving" abandon of a manual add-flow.
// Rules: show after N signals; after showing, require the cooldown to elapse AND N fresh signals
// before re-showing; never more than once per session; hard cap on lifetime shows; and once
// records are connected it never shows again. All state is persisted (survives reloads).
const ENGAGEMENT_KEY = 'o4m_engagement_v1'
const RECORDS_CONNECTED_KEY = 'o4m_records_connected'
const ENGAGEMENT_SIGNAL_THRESHOLD = 2                       // signals needed to (re)show
const ENGAGEMENT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000      // 7 days between shows
const ENGAGEMENT_MAX_SHOWS = 3                              // lifetime impression cap
const ENGAGEMENT_SHOW_DELAY_MS = 1400                       // beat after the user completes the action, so the nudge doesn't interrupt
const _readEngagement = () => {
  try { return { shownCount: 0, lastShownAt: 0, signals: 0, ...JSON.parse(localStorage.getItem(ENGAGEMENT_KEY) || '{}') } }
  catch { return { shownCount: 0, lastShownAt: 0, signals: 0 } }
}
const _writeEngagement = (patch) => {
  try { localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify({ ..._readEngagement(), ...patch })) } catch {}
}
const areRecordsConnected = () => { try { return localStorage.getItem(RECORDS_CONNECTED_KEY) === '1' } catch { return false } }
const markRecordsConnected = () => { try { localStorage.setItem(RECORDS_CONNECTED_KEY, '1') } catch {} }
// Reset the whole connect-records nudge (engagement counters + card state + connected flag).
// Called on new-account / logout so a fresh user doesn't inherit a prior session's nudge state.
const clearEngagementState = () => { try { localStorage.removeItem(ENGAGEMENT_KEY); localStorage.removeItem(RECORDS_CONNECTED_KEY) } catch {} }
// Persistent "records not synced" timeline card: activated when the nudge is dismissed without
// connecting; dismissed for good by the user; hidden once records are connected.
const activateRecordsCard = () => _writeEngagement({ cardActive: true })
const dismissRecordsCard = () => _writeEngagement({ cardDismissed: true })
const shouldShowRecordsCard = () => { const s = _readEngagement(); return !!s.cardActive && !s.cardDismissed && !areRecordsConnected() }
// Record one high-intent signal. Returns true if the nudge should show now.
// sessionShown = has it already shown this session (in-memory, enforces once-per-session).
const registerEngagementSignal = ({ sessionShown }) => {
  if (areRecordsConnected()) return false                  // terminal: goal achieved
  const s = _readEngagement()
  if (s.shownCount >= ENGAGEMENT_MAX_SHOWS) return false    // lifetime cap reached
  const signals = (s.signals || 0) + 1
  const cooledDown = !s.lastShownAt || (Date.now() - s.lastShownAt) >= ENGAGEMENT_COOLDOWN_MS
  if (signals >= ENGAGEMENT_SIGNAL_THRESHOLD && cooledDown && !sessionShown) {
    _writeEngagement({ signals: 0, lastShownAt: Date.now(), shownCount: s.shownCount + 1 })
    return true
  }
  _writeEngagement({ signals })                            // accumulate toward the next show
  return false
}

// ─── HELPERS ─────────────────────────────────────────────────────
const fmtTime12 = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}
const shortDrName = (fullName) => {
  if (!fullName) return ''
  const parts = fullName.trim().split(' ')
  if (parts[0] === 'Dr.' && parts.length >= 3) return `Dr. ${parts[parts.length - 1]}`
  return fullName
}
const relativeApptDate = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const diffDays = Math.round((d - today) / (1000 * 60 * 60 * 24))
  if (diffDays === 1) return 'tomorrow'
  if (diffDays >= 2 && diffDays <= 6) return `next ${d.toLocaleDateString('en-US', { weekday: 'long' })}`
  return `on ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
}

const fmtDate = (d, opts = {}) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...opts }) : ''
const dayLabel = (dateStr) => {
  const today = new Date()
  today.setHours(12, 0, 0, 0) // noon, to match the parsed date below — comparing noon-to-noon keeps deltaDays a clean integer (midnight-vs-noon left every date +0.5 → Math.round pushed today to "Tomorrow")
  const d = new Date(dateStr + 'T12:00:00')
  const deltaDays = Math.round((d - today) / 86400000)
  const thisYear = today.getFullYear() === d.getFullYear()
  const shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(thisYear ? {} : { year: 'numeric' }) })
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  if (deltaDays === -1) return { prefix: 'Yesterday', shortDate }
  if (deltaDays >= -7 && deltaDays <= -2) return { prefix: weekday, shortDate }
  if (deltaDays === 1) return { prefix: 'Tomorrow', shortDate }
  if (deltaDays >= 2 && deltaDays <= 7) return { prefix: weekday, shortDate }
  return { prefix: null, shortDate }
}
const fmtDateRange = (s, e) => {
  if (!s) return ''
  if (!e) return fmtDate(s)
  const sd = new Date(s + 'T12:00:00'), ed = new Date(e + 'T12:00:00')
  const sameYear = sd.getFullYear() === ed.getFullYear()
  const sameMonth = sameYear && sd.getMonth() === ed.getMonth()
  const thisYear = sd.getFullYear() === new Date().getFullYear()
  // Start: always show month+day, show year only if not this year
  const startStr = fmtDate(s, thisYear && sameYear ? {} : { year: 'numeric' })
  // End: omit month if same month, omit year if same year as start and this year
  const endDay = ed.getDate()
  if (sameMonth) return `${startStr} – ${endDay}`
  const endStr = fmtDate(e, thisYear && sameYear ? {} : { year: 'numeric' })
  return `${startStr} – ${endStr}`
}

// ─── ICONS ────────────────────────────────────────────────────────
const Ico = {
  back: () => <svg width="10" height="17" viewBox="0 0 10 17" fill="none"><path d="M9 1.5L1.5 8.5L9 15.5" stroke={C.textIcon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  close: () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1L12 12M12 1L1 12" stroke={C.textIcon} strokeWidth="1.8" strokeLinecap="round"/></svg>,
  search: ({ on }) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke={on ? C.primary : '#888'} strokeWidth="1.5"/><path d="M11 11L14 14" stroke={on ? C.primary : '#888'} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  chevRight: () => <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M1 1.5L5.5 5.5L1 9.5" stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevDown: ({ open }) => <svg width="13" height="8" viewBox="0 0 13 8" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s ease', flexShrink: 0 }}><path d="M1.5 1.5L6.5 6.5L11.5 1.5" stroke="rgba(0,0,0,0.35)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  plus: () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3V17M3 10H17" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>,
  spark: () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L9.1 5.6L14 7.5L9.1 9.4L7.5 14L5.9 9.4L1 7.5L5.9 5.6L7.5 1Z" fill={C.primary} stroke={C.primary} strokeWidth="0.4" strokeLinejoin="round"/></svg>,
  thumbUp: () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1.5 7.5h2v5.5h-2zM3.5 7.5L5.5 3l1.5.5V6.5H11L10 12H3.5z" stroke={C.textSecondary} strokeWidth="1.1" strokeLinejoin="round"/></svg>,
  thumbDown: () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13.5 7.5h-2V2h2zM11.5 7.5L9.5 12l-1.5-.5V8H4L5 3h6.5z" stroke={C.textSecondary} strokeWidth="1.1" strokeLinejoin="round"/></svg>,
  cal:   () => <svg width="15" height="16" viewBox="0 0 15 16" fill="none"><rect x="1" y="2" width="13" height="12.5" rx="2" stroke="#888" strokeWidth="1.3"/><path d="M5 1V3M10 1V3M1 6H14" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  clock: () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="#888" strokeWidth="1.3"/><path d="M7.5 4.5V8L10 9.5" stroke="#888" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  notes: () => <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M1 1H13M1 5H10M1 9H8" stroke="rgba(0,0,0,0.3)" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  info:  () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6.5" stroke={C.textTertiary} strokeWidth="1.3"/><path d="M7.5 7v3.5" stroke={C.textTertiary} strokeWidth="1.4" strokeLinecap="round"/><circle cx="7.5" cy="5" r="0.75" fill={C.textTertiary}/></svg>,
  question: () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6.5" stroke={C.textTertiary} strokeWidth="1.3"/><path d="M5.5 5.5a2 2 0 1 1 2 2v1" stroke={C.textTertiary} strokeWidth="1.3" strokeLinecap="round"/><circle cx="7.5" cy="10.5" r="0.75" fill={C.textTertiary}/></svg>,

  // Timeline rail icons — square badges matching design
  diagnosisRail: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="0.5" y="0.5" width="35" height="35" rx="17.5" fill="white" stroke={C.border}/>
      <rect x="9" y="9" width="18" height="18" rx="2" stroke={C.textIcon} strokeWidth="1.4"/>
      <path d="M12 14h6M12 17.5h4M12 21h7" stroke={C.textIcon} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M19 13v4h4" stroke={C.textIcon} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  procedureRail: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="0.5" y="0.5" width="35" height="35" rx="17.5" fill="white" stroke={C.border}/>
      <circle cx="18" cy="15" r="4" stroke={C.textIcon} strokeWidth="1.4"/>
      <path d="M14 24c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={C.textIcon} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M18 13v4M16 15h4" stroke={C.textIcon} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  medicationRail: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="0.5" y="0.5" width="35" height="35" rx="17.5" fill="white" stroke={C.border}/>
      <rect x="13" y="10" width="10" height="16" rx="5" stroke={C.textIcon} strokeWidth="1.4"/>
      <path d="M13 18h10" stroke={C.textIcon} strokeWidth="1.3"/>
    </svg>
  ),
  scanRail: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="0.5" y="0.5" width="35" height="35" rx="17.5" fill="white" stroke={C.border}/>
      <rect x="9" y="12" width="18" height="12" rx="2" stroke={C.textIcon} strokeWidth="1.4"/>
      <path d="M13 16h10M13 19h7" stroke={C.textIcon} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  suggestedRail: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="0.5" y="0.5" width="35" height="35" rx="17.5" fill="white" stroke="rgba(255,121,88,0.3)"/>
      <path d="M18 11l1.6 3.3 3.6.5-2.6 2.5.6 3.6L18 19.5l-3.2 1.4.6-3.6L13 14.8l3.6-.5L18 11z" stroke={C.primary} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
}

const RAIL_ICONS = {
  procedure:   'local_hospital',
  medication:  'pill',
  scan:        'person_search',
  diagnosis:   'clinical_notes',
  appointment: 'event',
  symptom:            'vital_signs',
  journal:            'edit_note',
  mood:               'mood',
  dose:               'medication',
  'pending-resolved': 'task_alt',
}
const railIcon = (type, size = 40) => {
  const name = RAIL_ICONS[type] || 'stethoscope'
  const fill = (type === 'medication' || type === 'appointment') ? 0 : 1
  const fvs = `'FILL' ${fill}, 'wght' 400`
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.bgApp, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span className="material-symbols-rounded" style={{ fontSize: Math.round(size * 0.55), color: C.textSecondary, fontVariationSettings: fvs }}>{name}</span>
    </div>
  )
}

const typeLabel = { procedure: 'Procedure/Surgery', medication: 'Medication', scan: 'Test', diagnosis: 'Diagnosis', symptom: 'Symptom', journal: 'Journal', mood: 'Mood', dose: 'Medication', 'pending-resolved': 'Resolved' }
const typeColor = { procedure: C.textSecondary, medication: C.textSecondary, scan: C.textSecondary, diagnosis: C.textSecondary }

// ─── PRIMITIVES ───────────────────────────────────────────────────
const StatusBar = ({ light }) => (
  <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', flexShrink: 0, backgroundColor: '#ffffff' }}>
    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "-apple-system, 'SF Pro Display', sans-serif", color: light ? 'white' : C.textPrimary }}>9:41</span>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="4" width="3" height="8" rx="0.5" fill={light ? 'white' : C.textPrimary}/><rect x="4.5" y="2.5" width="3" height="9.5" rx="0.5" fill={light ? 'white' : C.textPrimary}/><rect x="9" y="0.5" width="3" height="11.5" rx="0.5" fill={light ? 'white' : C.textPrimary}/><rect x="13.5" y="0" width="3.5" height="12" rx="0.5" fill={light ? 'white' : C.textPrimary} opacity="0.3"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.2 2.5 12.2 3.4 13.6 4.9L15 3.3C13.2 1.3 10.7 0 8 0S2.8 1.3 1 3.3L2.4 4.9C3.8 3.4 5.8 2.5 8 2.5Z" fill={light ? 'white' : C.textPrimary}/><path d="M8 6C9.4 6 10.7 6.6 11.6 7.6L13 6C11.7 4.8 10 4 8 4S4.3 4.8 3 6L4.4 7.6C5.3 6.6 6.6 6 8 6Z" fill={light ? 'white' : C.textPrimary}/><circle cx="8" cy="10" r="1.8" fill={light ? 'white' : C.textPrimary}/></svg>
      <div style={{ width: 25, height: 12, border: `1.5px solid ${light ? 'white' : C.textPrimary}`, borderRadius: 3, display: 'flex', alignItems: 'center', padding: '0 2px', position: 'relative' }}>
        <div style={{ width: 16, height: 7, background: light ? 'white' : C.textPrimary, borderRadius: 1.5 }}/>
        <div style={{ position: 'absolute', right: -4, width: 3, height: 5, background: light ? 'white' : C.textPrimary, borderRadius: '0 1px 1px 0' }}/>
      </div>
    </div>
  </div>
)

const NavBar = ({ title, subtitle, onBack, onClose, bg = C.bgCard }) => (
  <div style={{ height: 54, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: `1px solid ${C.border}`, backgroundColor: bg, flexShrink: 0 }}>
    {onBack
      ? <button onClick={onBack} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}><Ico.back/></button>
      : <div style={{ width: 38, flexShrink: 0 }}/>
    }
    <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', overflow: 'hidden' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{subtitle}</div>}
    </div>
    <button onClick={onClose} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
      <Ico.close/>
    </button>
  </div>
)

const DockedButton = ({ label, onClick, disabled, secondaryLabel, onSecondary }) => {
  const [dockShadow, setDockShadow] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Find the nearest scrollable ancestor (the content area this button is docked over)
    let scrollEl = el.parentElement
    while (scrollEl && getComputedStyle(scrollEl).overflowY !== 'auto' && getComputedStyle(scrollEl).overflowY !== 'scroll') {
      scrollEl = scrollEl.parentElement
    }
    if (!scrollEl) return
    const check = () => setDockShadow(scrollEl.scrollHeight - scrollEl.scrollTop > scrollEl.clientHeight + 2)
    check()
    scrollEl.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(scrollEl)
    return () => { scrollEl.removeEventListener('scroll', check); ro.disconnect() }
  }, [])
  return (
    <div ref={ref} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, padding: '12px 20px 34px', boxShadow: dockShadow ? '0 -4px 12px rgba(0,0,0,0.08)' : 'none', transition: 'box-shadow 0.2s' }}>
      <button onClick={!disabled ? onClick : undefined} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 16, fontWeight: 600, color: 'white', opacity: disabled ? 0.45 : 1, transition: 'opacity 0.15s' }}>
        {label}
      </button>
      {secondaryLabel && (
        <button onClick={onSecondary} style={{ width: '100%', height: 44, borderRadius: 9999, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: C.textSecondary, marginTop: 4 }}>
          {secondaryLabel}
        </button>
      )}
    </div>
  )
}

const SearchInput = ({ value, onChange }) => {
  const [on, setOn] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: on ? `2px solid ${C.primary}` : `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: on ? '9px 11px' : '10px 12px', backgroundColor: C.bgCard, transition: 'border-color 0.15s' }}>
      <Ico.search on={on}/>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} onFocus={() => setOn(true)} onBlur={() => setOn(false)} placeholder="Search" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: C.textPrimary, backgroundColor: 'transparent', fontFamily: 'Inter,sans-serif' }}/>
      {value && <button onClick={() => onChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><Ico.close/></button>}
    </div>
  )
}

// ─── IOS WHEEL PICKER ─────────────────────────────────────────────
const MONTHS_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_VALUES = ['01','02','03','04','05','06','07','08','09','10','11','12']
const PICKER_YEARS  = Array.from({ length: 16 }, (_, i) => String(2015 + i))
const PICKER_HOURS  = Array.from({ length: 12 }, (_, i) => String(i + 1))
const PICKER_MINS   = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const ITEM_H = 44

const WheelCol = ({ items, selectedIndex, onChange, width }) => {
  const ref = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    // Inject hide-scrollbar CSS once
    if (!document.getElementById('_whl_css')) {
      const s = document.createElement('style')
      s.id = '_whl_css'
      s.textContent = '.whl-scroll::-webkit-scrollbar{display:none}'
      document.head.appendChild(s)
    }
    // Set initial scroll position after layout
    requestAnimationFrame(() => {
      if (ref.current) ref.current.scrollTop = selectedIndex * ITEM_H
    })
  }, []) // mount only

  const onScroll = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!ref.current) return
      const idx = Math.round(ref.current.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(items.length - 1, idx))
      ref.current.scrollTop = clamped * ITEM_H
      onChange(clamped)
    }, 80)
  }

  return (
    <div style={{ position: 'relative', width: width || 70, flexShrink: 0 }}>
      <div
        ref={ref}
        className="whl-scroll"
        onScroll={onScroll}
        style={{
          height: ITEM_H * 5,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          paddingTop: ITEM_H * 2,
          paddingBottom: ITEM_H * 2,
        }}
      >
        {items.map((item, i) => (
          <div key={i} style={{
            height: ITEM_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            scrollSnapAlign: 'center',
            fontSize: 20,
            fontWeight: selectedIndex === i ? 600 : 400,
            color: selectedIndex === i ? C.textPrimary : C.textTertiary,
            userSelect: 'none',
            fontFamily: 'Inter,sans-serif',
          }}>
            {item}
          </div>
        ))}
      </div>
      {/* Selection bar */}
      <div style={{ position: 'absolute', top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H, borderTop: '1px solid rgba(0,0,0,0.12)', borderBottom: '1px solid rgba(0,0,0,0.12)', pointerEvents: 'none' }}/>
      {/* Top fade */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2, background: 'linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)', pointerEvents: 'none' }}/>
      {/* Bottom fade */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2, background: 'linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)', pointerEvents: 'none' }}/>
    </div>
  )
}

// yearRange: optional [fromYear, toYear] for dates outside the default 2015–2030 wheel
// (e.g. a birthdate). defaultValue: where the wheels start when there's no value yet.
const IosPickerSheet = ({ mode, value, min, max, onSave, onClose, yearRange = null, defaultValue = null }) => {
  // Parse min/max bounds (YYYY-MM-DD)
  const maxP = max ? max.split('-').map(Number) : null  // [y, m, d]
  const minP = min ? min.split('-').map(Number) : null

  // Limit year range to [minYear, maxYear]
  const yearSource = yearRange
    ? Array.from({ length: yearRange[1] - yearRange[0] + 1 }, (_, i) => String(yearRange[0] + i))
    : PICKER_YEARS
  const availYears = yearSource.filter(y => {
    const yi = parseInt(y)
    if (maxP && yi > maxP[0]) return false
    if (minP && yi < minP[0]) return false
    return true
  })

  const parseDate = (v) => {
    const today = new Date()
    if (!v && defaultValue) v = defaultValue
    if (!v) {
      // Default to today (or max if today exceeds max)
      const ref = maxP
        ? new Date(Math.min(today.getTime(), new Date(max + 'T12:00:00').getTime()))
        : today
      const yi = availYears.indexOf(String(ref.getFullYear()))
      return { m: ref.getMonth(), d: ref.getDate() - 1, y: yi >= 0 ? yi : availYears.length - 1 }
    }
    const [yStr, mStr, dStr] = v.split('-')
    const yi = availYears.indexOf(yStr)
    return { m: parseInt(mStr, 10) - 1, d: parseInt(dStr, 10) - 1, y: yi >= 0 ? yi : availYears.length - 1 }
  }
  const parseTime = (v) => {
    if (!v) return { h: 7, min: 0, p: 0 }
    const [hStr, mStr] = v.split(':')
    const h24 = parseInt(hStr, 10)
    const p = h24 >= 12 ? 1 : 0
    let h12 = h24 % 12
    if (h12 === 0) h12 = 12
    return { h: h12 - 1, min: parseInt(mStr, 10), p }
  }

  const initD = parseDate(value)
  const initT = parseTime(value)
  const [selM,   setSelM]   = useState(initD.m)
  const [selD,   setSelD]   = useState(initD.d)
  const [selY,   setSelY]   = useState(initD.y)
  const [selH,   setSelH]   = useState(initT.h)
  const [selMin, setSelMin] = useState(initT.min)
  const [selP,   setSelP]   = useState(initT.p)
  const [vis,    setVis]    = useState(false)

  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])

  const selYearNum = parseInt(availYears[selY] || availYears[availYears.length - 1])

  // For the selected year, compute which months are available
  const availMonthIdxs = MONTHS_LABELS.map((_, i) => i).filter(mi => {
    if (maxP && selYearNum === maxP[0] && mi + 1 > maxP[1]) return false
    if (minP && selYearNum === minP[0] && mi + 1 < minP[1]) return false
    return true
  })
  const availMonthLabels = availMonthIdxs.map(i => MONTHS_LABELS[i])
  // Map selM (0-11) into the available-months index
  const selMAvailIdx = Math.max(0, availMonthIdxs.indexOf(selM) >= 0
    ? availMonthIdxs.indexOf(selM)
    : availMonthIdxs.length - 1)
  const actualMonthIdx = availMonthIdxs[selMAvailIdx] ?? selM  // 0-11

  // Days available for the selected month/year
  const totalDays = new Date(selYearNum, actualMonthIdx + 1, 0).getDate()
  const maxDayNum = (maxP && selYearNum === maxP[0] && actualMonthIdx + 1 === maxP[1])
    ? maxP[2] : totalDays
  const minDayNum = (minP && selYearNum === minP[0] && actualMonthIdx + 1 === minP[1])
    ? minP[2] : 1
  const DAYS = Array.from({ length: maxDayNum - minDayNum + 1 }, (_, i) => String(minDayNum + i))
  const clampedD = Math.min(selD, DAYS.length - 1)

  const handleDone = () => {
    let result
    if (mode === 'date') {
      const dayNum = parseInt(DAYS[clampedD] || DAYS[DAYS.length - 1])
      result = `${availYears[selY]}-${MONTHS_VALUES[actualMonthIdx]}-${String(dayNum).padStart(2, '0')}`
      // Final clamp: never exceed max or go below min
      if (max && result > max) result = max
      if (min && result < min) result = min
    } else {
      const h12 = selH + 1
      const h24 = selP === 0 ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12)
      result = `${String(h24).padStart(2, '0')}:${PICKER_MINS[selMin]}`
    }
    onSave(result)
    setVis(false)
    setTimeout(onClose, 350)
  }

  const handleCancel = () => { setVis(false); setTimeout(onClose, 350) }

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={handleCancel}>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${vis ? 0.3 : 0})`, transition: 'background 0.35s' }}/>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', background: '#fff', borderRadius: '20px 20px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
        transform: `translateY(${vis ? '0%' : '100%'})`,
        transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
          <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.textSecondary, padding: 4, fontFamily: 'Inter,sans-serif' }}>Cancel</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, fontFamily: 'Inter,sans-serif' }}>{mode === 'date' ? 'Select Date' : 'Select Time'}</div>
          <button onClick={handleDone} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.primary, fontWeight: 600, padding: 4, fontFamily: 'Inter,sans-serif' }}>Done</button>
        </div>
        {/* Wheels */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '12px 20px 24px' }}>
          {mode === 'date' ? <>
            <WheelCol key={`month-${selY}`} items={availMonthLabels} selectedIndex={selMAvailIdx} onChange={i => setSelM(availMonthIdxs[i] ?? i)} width={74}/>
            <WheelCol key={`day-${actualMonthIdx}-${selY}`} items={DAYS} selectedIndex={clampedD} onChange={setSelD} width={52}/>
            <WheelCol key="year" items={availYears} selectedIndex={selY} onChange={setSelY} width={74}/>
          </> : <>
            <WheelCol key="hour" items={PICKER_HOURS} selectedIndex={selH} onChange={setSelH} width={52}/>
            <div style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, paddingBottom: 2 }}>:</div>
            <WheelCol key="min" items={PICKER_MINS} selectedIndex={selMin} onChange={setSelMin} width={52}/>
            <WheelCol key="period" items={['AM','PM']} selectedIndex={selP} onChange={setSelP} width={60}/>
          </>}
        </div>
      </div>
    </div>,
    document.body
  )
}

const DateInputField = ({ label, value, onChange, required, min, max, hint = 'Approximate dates are fine. You can update this later.', yearRange = null, defaultValue = null, placeholder = 'Select date' }) => {
  const [open, setOpen] = useState(false)
  const fmt = (v) => {
    if (!v) return ''
    const [y, m, d] = v.split('-')
    return `${MONTHS_LABELS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>{label}{required && <span style={{ color: C.primary }}> *</span>}</div>
      <div style={{ border: `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '12px', display: 'flex', alignItems: 'center', backgroundColor: C.bgCard, cursor: 'pointer' }} onClick={() => setOpen(true)}>
        <div style={{ flex: 1, fontSize: 16, color: value ? C.textPrimary : C.textTertiary }}>
          {fmt(value) || placeholder}
        </div>
        {value
          ? <button onMouseDown={e => e.preventDefault()} onClick={e => { e.stopPropagation(); onChange('') }}
              style={{ flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: C.textTertiary, fontSize: 16, lineHeight: 1, padding: 0 }}>
              ✕
            </button>
          : <Ico.cal/>}
      </div>
      {hint && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 5 }}>{hint}</div>}
      {open && <IosPickerSheet mode="date" value={value} min={min} max={max} yearRange={yearRange} defaultValue={defaultValue} onSave={v => onChange(v)} onClose={() => setOpen(false)}/>}
    </div>
  )
}

const NotesTextarea = ({ value, onChange, placeholder }) => {
  const [on, setOn] = useState(false)
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} onFocus={() => setOn(true)} onBlur={() => setOn(false)} placeholder={placeholder} rows={5} style={{ width: '100%', border: on ? `2px solid ${C.primary}` : `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: 12, fontSize: 16, color: C.textPrimary, fontFamily: 'Inter,sans-serif', resize: 'none', outline: 'none', backgroundColor: C.bgCard, lineHeight: 1.55 }}/>
  )
}

const TimeInputField = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false)
  const fmt = (v) => {
    if (!v) return ''
    const [hStr, mStr] = v.split(':')
    const h24 = parseInt(hStr, 10)
    const p = h24 >= 12 ? 'PM' : 'AM'
    let h12 = h24 % 12
    if (h12 === 0) h12 = 12
    return `${h12}:${mStr} ${p}`
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>{label}</div>
      <div style={{ border: `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '12px', display: 'flex', alignItems: 'center', backgroundColor: C.bgCard, cursor: 'pointer' }} onClick={() => setOpen(true)}>
        <div style={{ flex: 1, fontSize: 16, color: value ? C.textPrimary : C.textTertiary }}>
          {fmt(value) || 'Select time'}
        </div>
        {value
          ? <button onMouseDown={e => e.preventDefault()} onClick={e => { e.stopPropagation(); onChange('') }}
              style={{ flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: C.textTertiary, fontSize: 16, lineHeight: 1, padding: 0 }}>
              ✕
            </button>
          : <Ico.clock/>}
      </div>
      {open && <IosPickerSheet mode="time" value={value} onSave={v => onChange(v)} onClose={() => setOpen(false)}/>}
    </div>
  )
}

const TextInputField = ({ label, value, onChange, placeholder }) => {
  const [on, setOn] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>{label}</div>
      <div style={{ border: on ? `2px solid ${C.primary}` : `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '12px', backgroundColor: C.bgCard }}>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} onFocus={() => setOn(true)} onBlur={() => setOn(false)} placeholder={placeholder}
          style={{ fontSize: 16, color: C.textPrimary, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter,sans-serif', width: '100%' }}/>
      </div>
    </div>
  )
}

// ─── CATALOG SEARCH STEP ──────────────────────────────────────────
const CatalogSearchStep = ({ title, catalog, suggested, onSelect, onClose, onBack, planItems = [] }) => {
  const [q, setQ] = useState('')
  const lower = q.toLowerCase().trim()
  const filtered = lower ? searchCatalog(catalog, lower) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: C.bgCard }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, marginBottom: 16, lineHeight: '28px' }}>{title}</div>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Ico.search on={false}/></div>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search" style={{ width: '100%', height: 44, border: `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '0 12px 0 38px', fontSize: 16, color: C.textPrimary, backgroundColor: C.bgCard, outline: 'none', fontFamily: 'Inter, sans-serif' }}/>
        </div>
        {!lower && suggested?.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recommended based on diagnosis</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggested.map((item, i) => (
                  <button key={i} onClick={() => onSelect(item)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{item.name}</div>
                      {item.subtitle && <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{item.subtitle}</div>}
                    </div>
                    <Ico.chevRight/>
                  </button>
              ))}
            </div>
          </>
        )}
        {lower && filtered.length > 0 && (
          <div style={{ backgroundColor: C.bgCard, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {filtered.map((item, i) => (
                <button key={i} onClick={() => onSelect(item)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', width: '100%', background: 'none', border: 'none', borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{item.name}</div>
                    {item.subtitle && <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{item.subtitle}</div>}
                  </div>
                  <Ico.chevRight/>
                </button>
            ))}
          </div>
        )}
        {lower && filtered.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 16 }}>No results for "{q}"</div>
            <button onClick={() => onSelect({ name: q, subtitle: null, custom: true })} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px',
              backgroundColor: C.bgApp, border: 'none', borderRadius: 9999,
              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>add</span>
              Add "{q}"
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


// ─── FLOWS ────────────────────────────────────────────────────────

// Destructive confirmation shown when leaving a flow with unsaved input
const ChatDeleteDialog = ({ title, onCancel, onDelete }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', opacity: vis ? 1 : 0, transition: 'opacity 0.2s ease' }}/>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 320, backgroundColor: C.bgCard, borderRadius: 24,
        padding: '24px 16px 16px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        opacity: vis ? 1 : 0, transform: vis ? 'scale(1)' : 'scale(0.94)', transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4, marginBottom: 20, textAlign: 'left' }}>Are you sure you want to delete &ldquo;{title}&rdquo;?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Delete first (the action they came for), Cancel last: a quick tap at the bottom lands on the safe choice. */}
          <button onClick={onDelete} style={{ width: '100%', height: 44, borderRadius: 9999, backgroundColor: 'transparent', border: `1.5px solid ${C.border}`, cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#B00020' }}>
            Delete
          </button>
          <button onClick={onCancel} style={{ width: '100%', height: 44, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

const ConfirmLeaveDialog = ({ onKeepEditing, onLeave }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onKeepEditing} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', opacity: vis ? 1 : 0, transition: 'opacity 0.2s ease' }}/>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 320, backgroundColor: C.bgCard, borderRadius: 18,
        padding: '24px 20px 16px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        opacity: vis ? 1 : 0, transform: vis ? 'scale(1)' : 'scale(0.94)', transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, marginBottom: 6, textAlign: 'left' }}>Leave without saving?</div>
        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5, marginBottom: 20, textAlign: 'left' }}>Your changes won't be saved if you leave now.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onKeepEditing} style={{ width: '100%', height: 46, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'white' }}>
            Keep editing
          </button>
          <button onClick={onLeave} style={{ width: '100%', height: 46, borderRadius: 9999, backgroundColor: 'transparent', border: `1.5px solid ${C.border}`, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#ef4444' }}>
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  )
}

// FlowShell: slides the whole flow up from the bottom on mount/dismiss.
const FlowShell = ({ onClose, children, zIndex = 60, confirmClose = false }) => {
  const [vis, setVis] = useState(false)
  const [nav, setNav] = useState({ title: '', subtitle: null, onBack: null })
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  // viaConfirm = true only when the user went through the "Leave without saving" confirm dialog.
  const reallyDismiss = (viaConfirm = false) => { setVis(false); setTimeout(() => onClose(viaConfirm), 340) }
  const dismiss = () => {
    if (confirmClose) setShowLeaveConfirm(true)
    else reallyDismiss(false)
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex,
      transform: vis ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Persistent header — never slides */}
      <NavBar title={nav.title} subtitle={nav.subtitle} onBack={nav.onBack} onClose={dismiss}/>
      {/* Only content slides */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children(dismiss, setNav, reallyDismiss)}
      </div>
      {showLeaveConfirm && (
        <ConfirmLeaveDialog
          onKeepEditing={() => setShowLeaveConfirm(false)}
          onLeave={() => { setShowLeaveConfirm(false); reallyDismiss(true) }}
        />
      )}
    </div>
  )
}

// FlowStack: all steps rendered in a horizontal track; translates to show current step.
// Each step slot is a render-prop function (() => JSX) so it re-evaluates on every
// render with fresh state — fixing the stale-closure problem from static JSX children.
const FlowStack = ({ step, steps, navConfigs, setNav }) => {
  const count = steps.length
  useEffect(() => { if (navConfigs && setNav && navConfigs[step]) setNav(navConfigs[step]) }, [step])
  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        display: 'flex', flexDirection: 'row',
        width: `${count * 100}%`,
        height: '100%',
        transform: `translateX(${(-step * (100 / count))}%)`,
        transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
      }}>
        {steps.map((renderStep, i) => (
          <div key={i} style={{ width: `${100 / count}%`, height: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderStep()}
          </div>
        ))}
      </div>
    </div>
  )
}

// Shared step layout wrapper — keeps structure consistent across all flows
const StepView = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: C.bgCard, position: 'relative' }}>
    {children}
  </div>
)

// ── Procedure flow: Search → Date → Notes ──────────────────────────


const MedicationSearchSheet = ({ onClose, onSelect, planItems = [], diagnosisCode = '', catalogOverride, suggestedOverride, searchTitle }) => {
  const catalog = catalogOverride || getMedicationCatalog()
  const suggested = suggestedOverride || catalog.filter(m => {
    const sub = (m.subtitle || '').toLowerCase()
    if (diagnosisCode === 'RCC')    return sub.includes('kidney') || sub.includes('rcc')
    if (diagnosisCode === 'CRC')    return sub.includes('crc') || sub.includes('colorectal') || sub.includes('colon')
    if (diagnosisCode === 'BREAST') return sub.includes('breast')
    return false
  }).slice(0, 8)

  return (
    <FlowShell onClose={onClose}>
      {(dismiss, setNav) => (
        <MedicationSearchContent
          dismiss={dismiss}
          setNav={setNav}
          suggested={suggested}
          catalog={catalog}
          planItems={planItems}
          searchTitle={searchTitle}
          onSelect={item => { onSelect(item) }}
        />
      )}
    </FlowShell>
  )
}

const MedicationSearchContent = ({ dismiss, setNav, suggested, catalog, planItems, onSelect, searchTitle }) => {
  useEffect(() => {
    const title = searchTitle
      ? searchTitle.replace(/^What /, '').replace(/ would you like to add.$/, '').replace(/^add /i, 'Add ')
      : 'Add a medication'
    setNav({ title, subtitle: null, onBack: dismiss })
  }, [])
  return (
    <CatalogSearchStep
      title={searchTitle || "What medication would you like to add?"}
      catalog={catalog || getMedicationCatalog()}
      suggested={suggested}
      onSelect={onSelect}
      onClose={dismiss}
      onBack={dismiss}
      planItems={planItems}
    />
  )
}

// ─── FOLLOW-UP QUESTION SETS ─────────────────────────────────────
// ─── FOLLOW-UP QUESTION LIBRARY ───────────────────────────────────
// Questions keyed by the transition they represent. Each entry maps to a set
// of questions that are clinically meaningful for that specific change.

const FU_QUESTIONS = {
  // Primary treatment completed → adjuvant / next-step groups unlock
  primary_surgery: [
    {
      id: 'fu_proc_margins', type: 'radio',
      question: 'Did your surgeon mention the surgical margins?',
      options: [
        { value: 'negative', label: 'Negative margins (cancer-free edges)' },
        { value: 'positive', label: 'Positive margins (cancer at edges)' },
        { value: 'not_discussed', label: "It wasn't discussed yet" },
        { value: 'unsure', label: "I don't know" },
      ],
    },
    {
      id: 'fu_proc_pathology', type: 'radio',
      question: 'Has your pathology report come back?',
      options: [
        { value: 'yes_confirmed', label: 'Yes — diagnosis confirmed' },
        { value: 'yes_changed', label: 'Yes — something changed from the original diagnosis' },
        { value: 'pending', label: 'Still waiting for results' },
        { value: 'unsure', label: "I don't know" },
      ],
    },
  ],
  primary_nonsurgical: [
    {
      id: 'fu_proc_response', type: 'radio',
      question: 'Do you know how well the treatment worked?',
      options: [
        { value: 'complete', label: 'Complete response — no visible cancer' },
        { value: 'partial', label: 'Partial response — cancer reduced' },
        { value: 'stable', label: 'Stable — cancer unchanged' },
        { value: 'pending', label: 'Still waiting for results' },
        { value: 'unsure', label: "I don't know yet" },
      ],
    },
    {
      id: 'fu_proc_approach', type: 'radio',
      question: 'How was this procedure performed?',
      options: [
        { value: 'outpatient', label: 'Outpatient (went home same day)' },
        { value: 'inpatient', label: 'Inpatient (stayed overnight or longer)' },
        { value: 'unsure', label: "I don't know" },
      ],
    },
  ],
  // First-line systemic therapy started → subsequent therapy groups may apply
  firstline_medication: [
    {
      id: 'fu_med_status', type: 'radio',
      question: 'What is the current status of this treatment?',
      options: [
        { value: 'ongoing', label: "I'm currently taking it" },
        { value: 'completed', label: "I've completed the course" },
        { value: 'stopped', label: 'It was stopped early' },
        { value: 'not_started', label: "I haven't started yet" },
      ],
    },
    {
      id: 'fu_med_response', type: 'radio',
      question: 'Has your care team mentioned how you are responding?',
      options: [
        { value: 'responding', label: 'Yes — responding well' },
        { value: 'progressing', label: 'Yes — the cancer has progressed' },
        { value: 'too_early', label: "It's too early to tell" },
        { value: 'unsure', label: "I don't know" },
      ],
    },
  ],
  // Consolidation / transplant → maintenance groups unlock
  consolidation: [
    {
      id: 'fu_transplant_status', type: 'radio',
      question: 'Where are you in this process?',
      options: [
        { value: 'scheduled', label: 'Scheduled — not done yet' },
        { value: 'completed', label: 'Completed' },
        { value: 'in_recovery', label: 'Completed — still in recovery' },
        { value: 'unsure', label: "I don't know" },
      ],
    },
    {
      id: 'fu_transplant_response', type: 'radio',
      question: 'Did your care team discuss the response after treatment?',
      options: [
        { value: 'complete', label: 'Complete response' },
        { value: 'partial', label: 'Partial response' },
        { value: 'pending', label: 'Results still pending' },
        { value: 'unsure', label: "I don't know" },
      ],
    },
  ],
  // Scan result may affect surveillance vs. active treatment groups
  scan_result: [
    {
      id: 'fu_scan_result', type: 'radio',
      question: 'Were results available when you had this scan?',
      options: [
        { value: 'ned', label: 'No evidence of disease (NED / clear)' },
        { value: 'progression', label: 'Cancer found or has grown' },
        { value: 'abnormal', label: 'Something was found — follow-up needed' },
        { value: 'pending', label: 'Results are still pending' },
        { value: 'unsure', label: "I don't know" },
      ],
    },
  ],
  // Generic fallback — used when impact is detected but no specific set applies
  generic: [
    {
      id: 'fu_generic_status', type: 'radio',
      question: 'What is the current status of this?',
      options: [
        { value: 'completed', label: 'Completed' },
        { value: 'ongoing', label: 'Ongoing' },
        { value: 'scheduled', label: 'Scheduled — not done yet' },
        { value: 'unsure', label: "I don't know" },
      ],
    },
  ],
}

// ─── ITEM-AWARE FOLLOW-UP SELECTOR ────────────────────────────────
// Returns { questions, transitionCopy } if this item would impact recommendations,
// or null if the follow-up should be skipped entirely.
const shouldAskFollowUp = (item, planItems, patientState) => {
  if (!item || !planItems || !patientState) return null

  const impacts = wouldImpactRecommendations(item, planItems, patientState)
  if (!impacts) return null

  const ctx = getImpactContext(item, planItems, patientState)
  const newGroup = ctx?.appearing[0]
  const name = (item.name || '').toLowerCase()

  // Build transition copy dynamically from what's about to unlock
  const groupLabel = ctx?.newGroupLabel
  const transitionCopy = groupLabel
    ? `Adding ${item.name} updates your treatment plan. A few quick questions will help keep your recommendations accurate as you move into the ${groupLabel} phase.`
    : `Adding ${item.name} affects your treatment plan recommendations. A couple of questions will help keep everything accurate.`

  // Pick the most relevant question set based on what the item is
  // and which group transition it triggers
  let questionKey = 'generic'

  const isSurgery = /nephrectomy|mastectomy|resection|colectomy|prostatectomy|cystectomy|debulk|transplant|sct|bmt/i.test(name)
  const isNonsurgicalProcedure = /ablation|radiation|sbrt|surveillance|biopsy|cystoscopy|colonoscopy/i.test(name)
  const isScan = /ct|mri|pet|scan|x-ray|ultrasound|mammogram|bone scan|echocardiogram/i.test(name)
  const isConsolidation = /transplant|asct|sct|bmt|stem.cell/i.test(name)
  const isFirstlineMed = newGroup && /step1|firstline|first.line|induction|primary/i.test(newGroup.group || '')

  if (isScan) {
    questionKey = 'scan_result'
  } else if (isConsolidation) {
    questionKey = 'consolidation'
  } else if (isSurgery) {
    questionKey = 'primary_surgery'
  } else if (isNonsurgicalProcedure) {
    questionKey = 'primary_nonsurgical'
  } else if (isFirstlineMed) {
    questionKey = 'firstline_medication'
  } else if (item.type === 'medication') {
    questionKey = 'firstline_medication'
  }

  return {
    questions: FU_QUESTIONS[questionKey] || FU_QUESTIONS.generic,
    transitionCopy,
  }
}

// ─── FOLLOW-UP FLOW ───────────────────────────────────────────────
// Transition screen + question steps. Inserted before notes ONLY when
// shouldAskFollowUp() returns non-null (i.e. this item impacts recommendations).
// onComplete(answers) always called.

const FollowUpFlow = ({ questions, transitionCopy, onComplete, flowTitle, setNav, onBack }) => {
  const [step, setStep] = useState(-1) // -1 = transition
  const [stepDir, setStepDir] = useState(1)
  const [stepKey, setStepKey] = useState(0)
  const [answers, setAnswers] = useState({})

  useEffect(() => {
    if (setNav) setNav({ title: flowTitle, subtitle: null, onBack: step > -1 ? () => goBack() : (onBack || null) })
  }, [step])

  const stepTo = (n, dir = 1) => { setStepDir(dir); setStepKey(k => k + 1); setStep(n) }
  const goBack = () => stepTo(step - 1, -1)

  const handleSelect = (q, value) => {
    const next = { ...answers, [q.id]: value }
    setAnswers(next)
    setTimeout(() => {
      if (step + 1 < questions.length) stepTo(step + 1)
      else onComplete(next)
    }, 220)
  }

  if (step === -1) {
    return (
      <div key="fu-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: `stepEnterFwd 0.22s ease-out forwards` }}>
        <StepView>
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.3 }}>
              {transitionCopy || "This event updates your treatment plan. A few quick questions will keep your recommendations accurate."}
            </div>
          </div>
          <DockedButton label="Next" onClick={() => stepTo(0)}/>
        </StepView>
      </div>
    )
  }

  const q = questions[step]
  const selected = answers[q.id] || null

  return (
    <div key={stepKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: `stepEnter${stepDir > 0 ? 'Fwd' : 'Bwd'} 0.22s ease-out forwards` }}>
      <StepView>
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.3, marginBottom: 28 }}>
            {q.question}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.options.map(opt => {
              const isSelected = selected === opt.value
              return (
                <button key={opt.value} onClick={() => handleSelect(q, opt.value)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: isSelected ? C.primaryLight : C.bgCard, border: `1.5px solid ${isSelected ? C.primary : C.border}`, borderRadius: 13, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s, border-color 0.15s', width: '100%' }}>
                  <span style={{ fontSize: 15, fontWeight: isSelected ? 600 : 500, color: isSelected ? C.primary : C.textPrimary, transition: 'color 0.15s' }}>{opt.label}</span>
                  <Ico.chevRight/>
                </button>
              )
            })}
          </div>
        </div>
        <DockedButton
          label={step + 1 < questions.length ? 'Next' : 'Continue'}
          onClick={() => { if (step + 1 < questions.length) stepTo(step + 1); else onComplete(answers) }}
          disabled={!selected}
        />
      </StepView>
    </div>
  )
}

const AddProcedureFlow = ({ onClose, onComplete, preload, fromDetail, planItems = [], patientState }) => {
  const [sel, setSel] = useState(preload || null)
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [followUpAnswers, setFollowUpAnswers] = useState(null)

  const catalog = getProcedureCatalog()
  const suggested = getProcedureSuggested()

  return (
    <FlowShell onClose={onClose} confirmClose={!!sel}>
      {(dismiss, setNav) => {
        const [step, setStep] = useState(preload ? 1 : 0)
        const followUp = sel ? shouldAskFollowUp(sel, planItems, patientState) : null
        const hasFollowUp = !!followUp
        const notesStep = hasFollowUp ? 3 : 2
        const finish = () => { onComplete({ type: 'procedure', name: sel.name, date, notes, followUpAnswers, id: `proc-${Date.now()}` }); dismiss() }
        const navConfigs = [
          { title: 'Add Procedure or Surgery', subtitle: null, onBack: fromDetail ? dismiss : null },
          { title: 'Add Procedure or Surgery', subtitle: sel?.name, onBack: () => setStep(0) },
          ...(hasFollowUp ? [{ title: 'Add Procedure or Surgery', subtitle: sel?.name, onBack: () => setStep(1) }] : []),
          { title: 'Add Procedure or Surgery', subtitle: sel?.name, onBack: () => setStep(notesStep - 1) },
        ]
        const steps = [
          () => (
            <MedicationSearchContent
              dismiss={dismiss}
              setNav={setNav}
              catalog={catalog}
              suggested={suggested}
              planItems={planItems}
              searchTitle="What procedure or surgery would you like to add?"
              onSelect={item => { setSel(item); setStep(1) }}
            />
          ),
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>Add a date</div>
                <DateInputField label="Date" value={date} onChange={setDate} required/>
              </div>
              <DockedButton label="Next" onClick={() => setStep(hasFollowUp ? 2 : 2)} disabled={!date}/>
            </StepView>
          ),
          ...(hasFollowUp ? [() => (
            <FollowUpFlow
              questions={followUp.questions}
              transitionCopy={followUp.transitionCopy}
              flowTitle="Add Procedure or Surgery"
              setNav={setNav}
              onBack={() => setStep(1)}
              onComplete={ans => { setFollowUpAnswers(ans); setStep(notesStep) }}
            />
          )] : []),
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 160px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>Add notes</div>
                <NotesTextarea value={notes} onChange={setNotes} placeholder="e.g. Recovery went well. Follow-up in 6 weeks."/>
              </div>
              <DockedButton label="Add to plan" onClick={finish}/>
            </StepView>
          ),
        ]
        return <FlowStack step={step} setNav={setNav} navConfigs={navConfigs} steps={steps}/>
      }}
    </FlowShell>
  )
}


const AddScanFlow = ({ onClose, onComplete, preload, fromDetail, planItems = [], patientState }) => {
  const [sel, setSel] = useState(preload || null)
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [followUpAnswers, setFollowUpAnswers] = useState(null)

  const catalog = getScanCatalog()
  const suggested = getScanSuggested()

  return (
    <FlowShell onClose={onClose} confirmClose={!!sel}>
      {(dismiss, setNav) => {
        const [step, setStep] = useState(preload ? 1 : 0)
        const followUp = sel ? shouldAskFollowUp(sel, planItems, patientState) : null
        const hasFollowUp = !!followUp
        const notesStep = hasFollowUp ? 3 : 2
        const finish = () => { onComplete({ type: 'scan', name: sel.name, date, notes, followUpAnswers, id: `scan-${Date.now()}` }); dismiss() }
        const navConfigs = [
          { title: 'Add Scan or Test', subtitle: null, onBack: fromDetail ? dismiss : null },
          { title: 'Add Scan or Test', subtitle: sel?.name, onBack: () => setStep(0) },
          ...(hasFollowUp ? [{ title: 'Add Scan or Test', subtitle: sel?.name, onBack: () => setStep(1) }] : []),
          { title: 'Add Scan or Test', subtitle: sel?.name, onBack: () => setStep(notesStep - 1) },
        ]
        const steps = [
          () => (
            <MedicationSearchContent
              dismiss={dismiss}
              setNav={setNav}
              catalog={catalog}
              suggested={suggested}
              planItems={planItems}
              searchTitle="What scan, lab, or test would you like to add?"
              onSelect={item => { setSel(item); setStep(1) }}
            />
          ),
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>Add a date</div>
                <DateInputField label="Date" value={date} onChange={setDate} required/>
              </div>
              <DockedButton label="Next" onClick={() => setStep(2)} disabled={!date}/>
            </StepView>
          ),
          ...(hasFollowUp ? [() => (
            <FollowUpFlow
              questions={followUp.questions}
              transitionCopy={followUp.transitionCopy}
              flowTitle="Add Scan or Test"
              setNav={setNav}
              onBack={() => setStep(1)}
              onComplete={ans => { setFollowUpAnswers(ans); setStep(notesStep) }}
            />
          )] : []),
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 160px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>Add notes</div>
                <NotesTextarea value={notes} onChange={setNotes} placeholder="e.g. Results showed no evidence of disease."/>
              </div>
              <DockedButton label="Add to plan" onClick={finish}/>
            </StepView>
          ),
        ]
        return <FlowStack step={step} setNav={setNav} navConfigs={navConfigs} steps={steps}/>
      }}
    </FlowShell>
  )
}


const AddMedicationFlow = ({ onClose, onComplete, preload, fromDetail, planItems = [], patientState, shellZIndex, skipNotes = false }) => {
  const [sel, setSel] = useState(preload || null)
  const [start, setStart] = useState(localDateStr())
  const [end, setEnd] = useState('')
  const [dose, setDose] = useState('')
  const [notes, setNotes] = useState('')
  const [followUpAnswers, setFollowUpAnswers] = useState(null)

  const catalog = getMedicationCatalog()
  const suggested = catalog.filter(m => {
    const sub = (m.subtitle || '').toLowerCase()
    const code = patientState?.diagnosisCode || ''
    if (code === 'RCC')    return sub.includes('kidney') || sub.includes('rcc')
    if (code === 'CRC')    return sub.includes('crc') || sub.includes('colorectal') || sub.includes('colon')
    if (code === 'BREAST') return sub.includes('breast')
    if (code === 'LUNG')   return sub.includes('lung')
    if (code === 'PROS')   return sub.includes('prostate')
    if (code === 'BLAD')   return sub.includes('bladder')
    if (code === 'OV')     return sub.includes('ovarian') || sub.includes('ovary')
    if (code === 'LEUK')   return sub.includes('leukemia') || sub.includes('aml') || sub.includes('cml')
    if (code === 'LYMP')   return sub.includes('lymphoma')
    if (code === 'MM')     return sub.includes('myeloma')
    return false
  }).slice(0, 8)

  return (
    <FlowShell onClose={onClose} zIndex={shellZIndex} confirmClose={!!sel}>
      {(dismiss, setNav) => {
        const [step, setStep] = useState(preload ? 1 : 0)
        const isRegimen = sel?.isRegimen || false
        const followUp = sel ? shouldAskFollowUp(sel, planItems, patientState) : null
        const hasFollowUp = !!followUp
        const notesStep = hasFollowUp ? 4 : 3
        const finish = () => { onComplete({ type: 'medication', name: sel.name, dose, startDate: start, endDate: end, notes, followUpAnswers, isRegimen, date: start, id: `med-${Date.now()}` }); dismiss() }
        const navConfigs = [
          { title: 'Add Medication', subtitle: null, onBack: fromDetail ? dismiss : null },
          { title: 'Add Medication', subtitle: sel?.name, onBack: preload ? null : () => setStep(0) },
          { title: 'Add Medication', subtitle: sel?.name, onBack: () => setStep(1) },
          ...(hasFollowUp ? [{ title: 'Add Medication', subtitle: sel?.name, onBack: () => setStep(2) }] : []),
          ...(!skipNotes ? [{ title: 'Add Medication', subtitle: sel?.name, onBack: () => setStep(notesStep - 1) }] : []),
        ]
        const steps = [
          () => (
            <MedicationSearchContent
              dismiss={dismiss}
              setNav={setNav}
              catalog={catalog}
              suggested={suggested}
              planItems={planItems}
              searchTitle="Search medications"
              onSelect={item => { setSel(item); setStep(1) }}
            />
          ),
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>Add a start date (optionally add an end date)</div>
                <DateInputField label="Start date" value={start} onChange={setStart} required max={end || undefined}/>
                <DateInputField label="End date (if known)" value={end} onChange={setEnd} min={start || undefined}/>
              </div>
              <DockedButton label="Next" onClick={() => setStep(2)} disabled={!start}/>
            </StepView>
          ),
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 150px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>
                  {isRegimen ? 'Add a schedule' : 'Add a dose and schedule'}
                </div>
                <NotesTextarea value={dose} onChange={setDose} placeholder={isRegimen ? 'e.g. Every 2 weeks.' : 'e.g. 500mg orally twice daily'}/>
              </div>
              <DockedButton label={skipNotes ? 'Add to plan' : 'Next'} onClick={() => skipNotes ? finish() : setStep(hasFollowUp ? 3 : 3)} secondaryLabel="Skip" onSecondary={() => { setDose(''); skipNotes ? finish() : setStep(hasFollowUp ? 3 : 3) }}/>
            </StepView>
          ),
          ...(hasFollowUp ? [() => (
            <FollowUpFlow
              questions={followUp.questions}
              transitionCopy={followUp.transitionCopy}
              flowTitle="Add Medication"
              setNav={setNav}
              onBack={() => setStep(2)}
              onComplete={ans => { setFollowUpAnswers(ans); setStep(notesStep) }}
            />
          )] : []),
          ...(!skipNotes ? [() => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 160px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>Add notes</div>
                <NotesTextarea value={notes} onChange={setNotes} placeholder="e.g. Prescribed by Dr. Patel. Monitor for peripheral neuropathy."/>
              </div>
              <DockedButton label="Add to plan" onClick={finish}/>
            </StepView>
          )] : []),
        ]
        return <FlowStack step={step} setNav={setNav} navConfigs={navConfigs} steps={steps}/>
      }}
    </FlowShell>
  )
}

// ─── PROVIDER AVATAR ──────────────────────────────────────────────
const ProviderAvatar = ({ avatar }) => (
  <div style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <span style={{ fontSize: 12, fontWeight: 700, color: C.textIcon, fontFamily: 'Inter,sans-serif' }}>{avatar}</span>
  </div>
)

// ─── PROVIDER SEARCH STEP ─────────────────────────────────────────
const ProviderSearchStep = ({ onSelect, onSkip, setNav, dismiss, careTeam }) => {
  const [q, setQ] = useState('')
  const lower = q.toLowerCase().trim()

  useEffect(() => {
    setNav({ title: 'Add Appointment', subtitle: null, onBack: null })
  }, [])

  const filtered = lower
    ? PROVIDERS.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.subtitle.toLowerCase().includes(lower) ||
        p.searchTerms.some(t => t.includes(lower))
      )
    : []

  const isCareTeamMember = (p) => careTeam.some(ct => ct.name === p.name)

  const CareTeamBadge = () => (
    <span style={{ fontSize: 10, fontWeight: 700, color: C.primary, backgroundColor: C.primaryLight, borderRadius: 6, padding: '2px 7px', letterSpacing: '0.03em', flexShrink: 0 }}>Care team</span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: C.bgCard }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, marginBottom: 16, lineHeight: '28px' }}>Who is this appointment with?</div>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Ico.search on={!!lower}/></div>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search for a provider"
            style={{ width: '100%', height: 44, border: `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '0 12px 0 38px', fontSize: 16, color: C.textPrimary, backgroundColor: C.bgCard, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}/>
        </div>

        {/* Care team (no search query) */}
        {!lower && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Your care team</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {careTeam.map((p, i) => (
                <button key={i} onClick={() => onSelect(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <ProviderAvatar avatar={p.avatar}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 1 }}>{p.subtitle}</div>
                  </div>
                  <Ico.chevRight/>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Search results */}
        {lower && filtered.length > 0 && (
          <div style={{ backgroundColor: C.bgCard, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {filtered.map((p, i) => (
              <button key={i} onClick={() => onSelect(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', width: '100%', background: 'none', border: 'none', borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                <ProviderAvatar avatar={p.avatar}/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{p.name}</span>
                    {isCareTeamMember(p) && <CareTeamBadge/>}
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary }}>{p.subtitle}</div>
                </div>
                <Ico.chevRight/>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {lower && filtered.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 16 }}>No results for "{q}"</div>
            <button onClick={() => onSelect({ name: q, custom: true, location: '', avatar: q.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', backgroundColor: C.bgApp, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>add</span>
              Add "{q}"
            </button>
          </div>
        )}
      </div>
      {/* "I don't know yet" escape hatch */}
      <div style={{ backgroundColor: C.bgCard, padding: '8px 20px 34px', flexShrink: 0 }}>
        <button onClick={onSkip} style={{ width: '100%', height: 44, borderRadius: 9999, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: C.textSecondary }}>
          I don't know yet
        </button>
      </div>
    </div>
  )
}

// ─── ADD APPOINTMENT FLOW ─────────────────────────────────────────
const parseProviderLocation = (loc) => {
  if (!loc) return { street: '', city: '', stateAbbr: '', zip: '' }
  let s = loc.trim()
  let zip = ''
  const zipM = s.match(/\s(\d{5})(?:-\d{4})?$/)
  if (zipM) { zip = zipM[1]; s = s.slice(0, zipM.index).trim() }
  const parts = s.split(/\s+/)
  const last = parts[parts.length - 1]
  if (parts.length >= 3 && last.length === 2 && /^[A-Z]{2}$/.test(last)) {
    return { street: parts.slice(0, parts.length - 2).join(' '), city: parts[parts.length - 2], stateAbbr: last, zip }
  }
  return { street: s, city: '', stateAbbr: '', zip }
}

// Stubbed address lookup for the prototype (deterministic — production would call a geocoder).
const MOCK_ADDRESS_BOOK = [
  { street: '300 Longwood Ave', city: 'Boston', stateAbbr: 'MA', zip: '02115' },
  { street: '320 Longwood Ave', city: 'Boston', stateAbbr: 'MA', zip: '02115' },
  { street: '221 Longwood Ave', city: 'Boston', stateAbbr: 'MA', zip: '02115' },
  { street: '25 Shattuck St', city: 'Boston', stateAbbr: 'MA', zip: '02115' },
  { street: '75 Francis St', city: 'Boston', stateAbbr: 'MA', zip: '02115' },
  { street: '55 Fruit St', city: 'Boston', stateAbbr: 'MA', zip: '02114' },
  { street: '100 Cambridge St', city: 'Boston', stateAbbr: 'MA', zip: '02114' },
  { street: '330 Brookline Ave', city: 'Boston', stateAbbr: 'MA', zip: '02215' },
  { street: '450 Brookline Ave', city: 'Boston', stateAbbr: 'MA', zip: '02215' },
  { street: '185 Pilgrim Rd', city: 'Boston', stateAbbr: 'MA', zip: '02215' },
  { street: '1153 Centre St', city: 'Boston', stateAbbr: 'MA', zip: '02130' },
  { street: '1400 Pelham Pkwy S', city: 'Bronx', stateAbbr: 'NY', zip: '10461' },
  { street: '1275 York Ave', city: 'New York', stateAbbr: 'NY', zip: '10065' },
  { street: '1 Medical Center Blvd', city: 'Winston-Salem', stateAbbr: 'NC', zip: '27157' },
  { street: '500 University Ave', city: 'Sacramento', stateAbbr: 'CA', zip: '95817' },
]
const searchAddressBook = (q) => {
  const s = (q || '').trim().toLowerCase()
  if (s.length < 3) return []
  return MOCK_ADDRESS_BOOK.filter(a => `${a.street} ${a.city} ${a.stateAbbr} ${a.zip}`.toLowerCase().includes(s)).slice(0, 5)
}

// Street-address input with a live results dropdown. Selecting a result fills every field;
// typing text with no results simply stands as a custom address.
const AddressAutocomplete = ({ value, onChange, onPick, placeholder }) => {
  const [on, setOn] = useState(false)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const suppress = useRef(false)
  const recompute = (v) => { const r = searchAddressBook(v); setResults(r); setOpen(r.length > 0) }
  const handleChange = (v) => {
    onChange(v)
    if (suppress.current) { suppress.current = false; setOpen(false); return }
    recompute(v)
  }
  const pick = (r) => { suppress.current = true; onPick(r); setOpen(false); setResults([]) }
  return (
    <div style={{ marginBottom: 16, position: 'relative' }}>
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>Street address</div>
      <div style={{ border: on ? `2px solid ${C.primary}` : `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '12px', backgroundColor: C.bgCard }}>
        <input type="text" value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { setOn(true); if (value && !suppress.current) recompute(value) }}
          onBlur={() => { setOn(false); setTimeout(() => setOpen(false), 140) }}
          placeholder={placeholder}
          style={{ fontSize: 16, color: C.textPrimary, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter,sans-serif', width: '100%' }}/>
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden', zIndex: 30 }}>
          {results.map((r, i) => (
            <button key={i} onMouseDown={e => e.preventDefault()} onClick={() => pick(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: 'none', border: 'none', borderBottom: i < results.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400", flexShrink: 0 }}>location_on</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.street}</div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>{r.city}, {r.stateAbbr} {r.zip}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const AddAppointmentFlow = ({ onClose, onComplete }) => {
  const [careTeam, setCareTeam] = useState(() => {
    try { const s = localStorage.getItem('o4m_care_team'); return s ? JSON.parse(s) : PROVIDERS.slice(0, 3) } catch { return PROVIDERS.slice(0, 3) }
  })
  const addProviderToCareTeam = (p) => {
    setCareTeam(prev => {
      if (prev.some(ct => ct.name === p.name)) return prev
      const next = [...prev, p]
      try { localStorage.setItem('o4m_care_team', JSON.stringify(next)) } catch {}
      return next
    })
  }
  // Care team prompt sheet
  const [ctPromptOpen, setCtPromptOpen] = useState(false)
  const [ctPromptVisible, setCtPromptVisible] = useState(false)
  const [ctPendingProvider, setCtPendingProvider] = useState(null)
  const openCtPrompt = (p) => {
    setCtPendingProvider(p)
    setCtPromptOpen(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setCtPromptVisible(true)))
  }
  const closeCtPrompt = (andProceed) => {
    setCtPromptVisible(false)
    setTimeout(() => { setCtPromptOpen(false); setCtPendingProvider(null); if (andProceed) andProceed() }, 360)
  }

  const [provider, setProvider] = useState(null)
  const [apptDate, setApptDate] = useState('')
  const [apptTime, setApptTime] = useState('')
  const [apptType, setApptType] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [stateAbbr, setStateAbbr] = useState('')
  const [zip, setZip] = useState('')
  const [addrSkipped, setAddrSkipped] = useState(false)
  const [notes, setNotes] = useState('')
  const [providerStepDone, setProviderStepDone] = useState(false) // true once past provider (incl. "I don't know yet")

  // providerStepDone makes "I don't know yet" (provider stays null) still count as progress,
  // so leaving afterward triggers the "Leave without saving" warning like selecting a provider.
  const hasAnyInput = !!(provider || providerStepDone || apptDate || apptTime || apptType || street || city || zip || notes)

  return (
    <FlowShell onClose={onClose} confirmClose={hasAnyInput}>
      {(dismiss, setNav) => {
        const [step, setStep] = useState(0)
        const locationRequired = LOCATION_REQUIRED_TYPES.includes(apptType)
        const hasPrefilledLocation = !!(street || city || stateAbbr)
        const addrComplete = !!(street.trim() && city.trim() && stateAbbr.trim() && zip.trim())

        const handleProviderSelect = (p) => {
          setProvider(p)
          setProviderStepDone(true)
          setAddrSkipped(false)
          if (p.location) {
            const parsed = parseProviderLocation(p.location)
            setStreet(parsed.street); setCity(parsed.city); setStateAbbr(parsed.stateAbbr); setZip(parsed.zip || '')
          } else {
            setStreet(''); setCity(''); setStateAbbr(''); setZip('')
          }
          const inCareTeam = careTeam.some(ct => ct.name === p.name)
          if (!inCareTeam && !p.custom) {
            openCtPrompt(p)
          } else {
            setStep(1)
          }
        }

        const handleSkipProvider = () => {
          setProvider(null)
          setProviderStepDone(true)
          setAddrSkipped(false)
          setStreet(''); setCity(''); setStateAbbr(''); setZip('')
          setStep(1)
        }

        const handleTypeSelect = (type) => {
          setApptType(type)
          const needsLocation = LOCATION_REQUIRED_TYPES.includes(type)
          setTimeout(() => setStep(needsLocation ? 4 : 5), 220)
        }

        const finish = () => {
          const providerName = provider?.name || ''
          const locationStr = [street, [city, stateAbbr].filter(Boolean).join(' '), zip].filter(Boolean).join(', ')
          // Address is only saved when the location step ran, wasn't skipped, and is complete.
          const saveLocation = locationRequired && !addrSkipped && addrComplete
          onComplete({
            id: `appt-${Date.now()}`,
            type: 'appointment',
            name: providerName,
            provider: providerName,
            date: apptDate,
            time: apptTime || null,
            appointmentType: apptType,
            location: saveLocation ? locationStr : null,
            notes: notes || null,
          })
          dismiss()
        }

        const navConfigs = [
          { title: 'Add Appointment', subtitle: null, onBack: null },
          { title: 'Add Appointment', subtitle: provider?.name || null, onBack: () => setStep(0) },
          { title: 'Add Appointment', subtitle: provider?.name || null, onBack: () => setStep(1) },
          { title: 'Add Appointment', subtitle: provider?.name || null, onBack: () => setStep(2) },
          { title: 'Add Appointment', subtitle: provider?.name || null, onBack: () => setStep(3) },
          { title: 'Add Appointment', subtitle: provider?.name || null, onBack: () => setStep(locationRequired ? 4 : 3) },
        ]

        const steps = [
          // Step 0: Provider search
          () => (
            <ProviderSearchStep
              onSelect={handleProviderSelect}
              onSkip={handleSkipProvider}
              setNav={setNav}
              dismiss={dismiss}
              careTeam={careTeam}
            />
          ),
          // Step 1: Date
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>What day?</div>
                <DateInputField label="Date" value={apptDate} onChange={setApptDate} required/>
              </div>
              <DockedButton label="Next" onClick={() => setStep(2)} disabled={!apptDate}/>
            </StepView>
          ),
          // Step 2: Time (optional)
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>What time?</div>
                <TimeInputField label="Time" value={apptTime} onChange={setApptTime}/>
              </div>
              <DockedButton label="Next" onClick={() => setStep(3)}/>
            </StepView>
          ),
          // Step 3: Appointment type (auto-advance on tap)
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 32px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>What type of appointment?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {APPOINTMENT_TYPES.map(type => (
                    <button key={type} onClick={() => handleTypeSelect(type)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', backgroundColor: apptType === type ? C.primaryLight : C.bgCard, border: `1.5px solid ${apptType === type ? C.primary : C.border}`, borderRadius: 13, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background-color 0.15s, border-color 0.15s' }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: apptType === type ? C.primary : C.textPrimary }}>{type}</span>
                      <Ico.chevRight/>
                    </button>
                  ))}
                </div>
              </div>
            </StepView>
          ),
          // Step 4: Location — editable prefilled form; street field has an address lookup
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 6, lineHeight: 1.15 }}>Location</div>
                <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
                  {hasPrefilledLocation ? `From ${shortDrName(provider?.name)}'s profile — edit if needed` : 'Start typing a street address to search'}
                </div>
                {exp('addressLookup') === 'on' ? (
                  <AddressAutocomplete
                    value={street}
                    onChange={setStreet}
                    onPick={(r) => { setStreet(r.street); setCity(r.city); setStateAbbr(r.stateAbbr); setZip(r.zip) }}
                    placeholder="e.g. 300 Longwood Ave"
                  />
                ) : (
                  <TextInputField label="Street address" value={street} onChange={setStreet} placeholder="e.g. 300 Longwood Ave"/>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: '0 0 110px' }}><TextInputField label="ZIP code" value={zip} onChange={setZip} placeholder="02115"/></div>
                  <div style={{ flex: 1 }}><TextInputField label="City" value={city} onChange={setCity} placeholder="Boston"/></div>
                  <div style={{ flex: '0 0 64px' }}><TextInputField label="State" value={stateAbbr} onChange={setStateAbbr} placeholder="MA"/></div>
                </div>
              </div>
              <DockedButton
                label="Next"
                onClick={() => { setAddrSkipped(false); setStep(5) }}
                disabled={!addrComplete}
                secondaryLabel="Skip"
                onSecondary={() => { setAddrSkipped(true); setStep(5) }}
              />
            </StepView>
          ),
          // Step 5: Notes + Save
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 160px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.15 }}>Add notes</div>
                <NotesTextarea value={notes} onChange={setNotes} placeholder="e.g. Bring insurance card. Fasting required."/>
              </div>
              <DockedButton label="Save" onClick={finish}/>
            </StepView>
          ),
        ]

        return (
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <FlowStack step={step} setNav={setNav} navConfigs={navConfigs} steps={steps}/>
            {/* Add to care team prompt */}
            {ctPromptOpen && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
                <div onClick={() => closeCtPrompt(() => setStep(1))} style={{ position: 'absolute', inset: 0, backgroundColor: ctPromptVisible ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: 'background-color 0.36s ease' }}/>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  backgroundColor: C.bgApp, borderRadius: '20px 20px 0 0',
                  padding: '28px 20px 36px',
                  transform: ctPromptVisible ? 'translateY(0)' : 'translateY(100%)',
                  transition: 'transform 0.38s cubic-bezier(0.32,0.72,0,1)',
                  boxShadow: '0 -4px 32px rgba(0,0,0,0.12)'
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 8, letterSpacing: '-0.3px' }}>Add to your care team?</div>
                  <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5, marginBottom: 28 }}>
                    Add {shortDrName(ctPendingProvider?.name)} to make scheduling future appointments quicker.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button onClick={() => { addProviderToCareTeam(ctPendingProvider); closeCtPrompt(() => setStep(1)) }}
                      style={{ width: '100%', padding: '15px', backgroundColor: C.primary, color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                      Yes, add {shortDrName(ctPendingProvider?.name)}
                    </button>
                    <button onClick={() => closeCtPrompt(() => setStep(1))}
                      style={{ width: '100%', padding: '15px', backgroundColor: 'transparent', color: C.textSecondary, border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                      No thanks
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }}
    </FlowShell>
  )
}

// Persistent, dismissible timeline card nudging the user to sync health records.
const RecordsNotSyncedCard = ({ onOpenSettings, onDismiss }) => (
  <div style={{ position: 'relative', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px' }}>
    <button onClick={onDismiss} aria-label="Dismiss" style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>close</span>
    </button>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>sync_problem</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>Health records not synced</div>
        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45, marginBottom: 12 }}>You can sync your records in your profile under settings.</div>
        <button onClick={onOpenSettings} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: C.bgApp, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.primary }}>
          Open settings
        </button>
      </div>
    </div>
  </div>
)

// ─── ENGAGEMENT NUDGE (connect-records) — bottom sheet with the D illustration ──
const ENG_ANIM_CSS = `
.o4mplay .rec-pop-d{ transform-box:fill-box; transform-origin:center; opacity:0; animation:engRecPop .55s cubic-bezier(.3,.8,.35,1) .2s both; }
.o4mplay .rec-move-d{ animation:engRecMove .5s cubic-bezier(.4,0,.2,1) .85s both; }
.o4mplay .tl-scroll-d{ opacity:0; animation:engTlScroll .6s cubic-bezier(.2,.7,.2,1) .85s both; }
.o4mplay .tl-line-d{ opacity:0; animation:engFadeIn .4s ease .95s forwards; }
.o4mplay .wire-d{ stroke-dasharray:48; stroke-dashoffset:48; animation:engWireDraw .45s ease-out 1.4s forwards; }
.o4mplay .wire-head-d{ stroke-dasharray:10; stroke-dashoffset:10; animation:engWireDraw .18s ease-out 1.82s forwards; }
.o4mplay .gray-top-d{ animation:engGrayTop .45s cubic-bezier(.4,0,.2,1) 1.9s both; }
.o4mplay .gray-bot-d{ animation:engGrayBot .45s cubic-bezier(.4,0,.2,1) 1.9s both; }
.o4mplay .new-in-d{ transform-box:fill-box; transform-origin:center; opacity:0; animation:engNewIn .4s cubic-bezier(.34,1.4,.64,1) 2.1s both; }
.o4mplay .tag-in-d{ transform-box:fill-box; transform-origin:center; opacity:0; animation:engTagIn .3s cubic-bezier(.34,1.56,.64,1) 2.4s both; }
@keyframes engRecPop{ 0%{opacity:0; transform:scale(.55)} 45%{opacity:1} 62%{transform:scale(1.32)} 100%{opacity:1; transform:scale(1.18)} }
@keyframes engRecMove{ to{ transform:translateX(-78px); } }
@keyframes engTlScroll{ 0%{opacity:0; transform:translateY(0)} 100%{opacity:1; transform:translateY(-44px)} }
@keyframes engGrayTop{ to{ transform:translateY(-4px); } }
@keyframes engGrayBot{ to{ transform:translateY(24px); } }
@keyframes engNewIn{ 0%{opacity:0; transform:translateY(6px) scale(.9)} 100%{opacity:1; transform:translateY(0) scale(1)} }
@keyframes engTagIn{ 0%{opacity:0; transform:scale(.6)} 100%{opacity:1; transform:scale(1)} }
@keyframes engWireDraw{ to{ stroke-dashoffset:0; } }
@keyframes engFadeIn{ to{ opacity:1; } }
`
const EngagementNudgeSheet = ({ onConnect, onDismiss }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const close = (cb) => { setVis(false); setTimeout(() => cb && cb(), 320) }
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
      <style>{ENG_ANIM_CSS}</style>
      <div onClick={() => close(onDismiss)} style={{ position: 'absolute', inset: 0, backgroundColor: vis ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: 'background-color 0.32s ease' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bgCard, borderRadius: '22px 22px 0 0', boxShadow: '0 -6px 28px rgba(0,0,0,0.16)', padding: '10px 20px 28px', transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.36s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '0 auto 14px' }}/>
        <div className="o4mplay" style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 6px' }}>
          <svg viewBox="20 0 260 148" width="240" height="137" xmlns="http://www.w3.org/2000/svg">
            <defs><clipPath id="o4mEngWin"><rect x="138" y="34" width="122" height="90" rx="8"/></clipPath></defs>
            <g clipPath="url(#o4mEngWin)">
              <g className="tl-line-d"><line x1="150" y1="36" x2="150" y2="120" stroke="#e6e6ea" strokeWidth="3" strokeLinecap="round"/></g>
              <g className="tl-scroll-d">
                <g>
                  <circle cx="150" cy="66" r="5" fill="#c9ccd3" stroke="#fff" strokeWidth="2"/>
                  <rect x="162" y="59" width="60" height="16" rx="6" fill="#fff" stroke="#eceef1" strokeWidth="1.2"/>
                  <rect x="170" y="65" width="30" height="4" rx="2" fill="#e9eaee"/>
                </g>
                <g className="gray-top-d">
                  <circle cx="150" cy="98" r="5" fill="#c9ccd3" stroke="#fff" strokeWidth="2"/>
                  <rect x="162" y="91" width="72" height="16" rx="6" fill="#fff" stroke="#eceef1" strokeWidth="1.2"/>
                  <rect x="170" y="97" width="38" height="4" rx="2" fill="#e9eaee"/>
                </g>
                <g className="gray-bot-d">
                  <circle cx="150" cy="130" r="5" fill="#c9ccd3" stroke="#fff" strokeWidth="2"/>
                  <rect x="162" y="123" width="64" height="16" rx="6" fill="#fff" stroke="#eceef1" strokeWidth="1.2"/>
                  <rect x="170" y="129" width="32" height="4" rx="2" fill="#e9eaee"/>
                </g>
                <g className="new-in-d">
                  <circle cx="150" cy="124" r="5.5" fill="#ff7a59" stroke="#fff" strokeWidth="2"/>
                  <rect x="162" y="115" width="86" height="19" rx="6" fill="#fff1ec" stroke="#ffd0c2" strokeWidth="1.3"/>
                  <rect x="170" y="123" width="30" height="4" rx="2" fill="#ffb59f"/>
                  <g className="tag-in-d">
                    <rect x="212" y="119.5" width="28" height="11" rx="5.5" fill="#ff7a59"/>
                    <text x="226" y="127.4" fontSize="7" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="0.3">NEW</text>
                  </g>
                </g>
              </g>
            </g>
            <path className="wire-d" d="M101 79 Q 116 78 131 80" fill="none" stroke="#ff7a59" strokeWidth="2" strokeLinecap="round"/>
            <path className="wire-head-d" d="M136 80 L130 75" fill="none" stroke="#ff7a59" strokeWidth="2" strokeLinecap="round"/>
            <path className="wire-head-d" d="M136 80 L130 85" fill="none" stroke="#ff7a59" strokeWidth="2" strokeLinecap="round"/>
            <g transform="translate(150,74)">
              <g className="rec-move-d">
                <g className="rec-pop-d">
                  <rect x="-17" y="-21" width="34" height="42" rx="8" fill="#fff" stroke="#e6e6ea" strokeWidth="1.5"/>
                  <rect x="-9" y="-12" width="20" height="3.5" rx="1.75" fill="#e9eaee"/>
                  <rect x="-9" y="-5" width="14" height="3.5" rx="1.75" fill="#eef0f3"/>
                  <path d="M-9 8 h6 l2 -6 3 11 2.5 -5 h5" fill="none" stroke="#ff7a59" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
              </g>
            </g>
          </svg>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.3px', color: C.textPrimary, textAlign: 'center', lineHeight: 1.25 }}>See your care add up — without the typing</div>
        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5, textAlign: 'center', margin: '8px 4px 0' }}>Connect your records so it all comes together — the clearer the picture, the better your guidance and treatment options.</div>
        <button onClick={() => close(onConnect)} style={{ width: '100%', padding: '15px', backgroundColor: C.primary, color: '#fff', border: 'none', borderRadius: 9999, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 18, fontFamily: 'Inter,sans-serif' }}>Connect medical records</button>
        <button onClick={() => close(onDismiss)} style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: C.textSecondary, border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4, fontFamily: 'Inter,sans-serif' }}>Not now</button>
      </div>
    </div>,
    document.body
  )
}

const DailySummaryCard = ({ summary, isToday, onAddEvent, cancerSupported = true, onReviewRecs, teasers = [], onTeaserAction, narrative = null, onViewTreatments = null, onViewRecord = null, hasTreatments = false }) => {
  const bullets = summary.bullets || []
  // Signature drives the change/generating animation without parsing text (bullet ids + text).
  const signature = bullets.map(b => b.id + ':' + b.text).join('|')
  const [vote, setVote] = useState(null)  // 'up' | 'down' | null
  const castVote = (v) => (e) => { e.stopPropagation(); setVote(prev => prev === v ? null : v) }

  const [shownBullets, setShownBullets] = useState(bullets)
  const [generating, setGenerating] = useState(false)
  const [textOpacity, setTextOpacity] = useState(1)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const prevSigRef = useRef(signature)
  const pendingRef = useRef(null)
  const genStartRef = useRef(0)
  const resolvingRef = useRef(false)
  const cardRef = useRef(null)
  const starRef = useRef(null)

  // Change marking (§6): diff current bullets vs the last version the patient SAW (id + text),
  // persisted to localStorage so a change stays flagged until viewed. Changed bullets carry an
  // inline New/Updated tag; marks clear once the card has been on screen. (No collapsed state now.)
  // Prototype change-marking (illustrative): diff the rendered bullet text, matched by id, against the
  // last version the patient saw — catches adds/removes AND in-place edits. It can also flag purely
  // time-driven re-wording (the "today" bullet at midnight), which won't surface in a demo session.
  // Production should diff the underlying RECORD content instead — see the spec §6 note.
  const SEEN_KEY = 'o4m_summary_seen_v3'
  const [onScreen, setOnScreen] = useState(false)
  const [clearing, setClearing] = useState(false)  // brief fade-out phase before marks are committed as seen
  const [seenSet, setSeenSet] = useState(() => {
    try { const raw = localStorage.getItem(SEEN_KEY); if (raw) return new Set(JSON.parse(raw)) } catch {}
    // First-ever view establishes the baseline — nothing is marked on first load.
    const sig = (summary.bullets || []).map(b => b.id + ':' + b.text)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(sig)) } catch {}
    return new Set(sig)
  })
  const seenIds = new Set([...seenSet].map(s => s.slice(0, s.indexOf(':'))))
  const changeOf = (b) => seenSet.has(b.id + ':' + b.text) ? null : (seenIds.has(b.id) ? 'updated' : 'new')

  // Card state — two states:
  //   Rich   = has a time-sensitive bullet (today / upcoming / treatments) → bullets + AI footer
  //   Empty  = nothing to show yet (quiet OR unsupported) → single "Add an event" fallback
  const hasActionable = shownBullets.some(b => ['today', 'upcoming', 'treatments'].includes(b.id)) || teasers.length > 0
  const state = hasActionable ? 'rich' : 'empty'
  const openAdd = (e) => { e.stopPropagation(); if (onAddEvent) onAddEvent() }

  const isVisible = useCallback(() => {
    const el = cardRef.current
    if (!el || !el.getBoundingClientRect) return true
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight || 0
    if (!vh) return true
    return r.top < vh * 0.85 && r.bottom > vh * 0.15
  }, [])

  const tryDeliver = useCallback(() => {
    if (pendingRef.current == null || resolvingRef.current) return
    resolvingRef.current = true
    const commit = () => {
      setShownBullets(pendingRef.current)
      pendingRef.current = null
      setGenerating(false)
      resolvingRef.current = false
    }
    // Off screen: commit the new content immediately (no fade) so the summary is always current
    // even when adding an event scrolls it out of view. The fade is only a nicety when visible.
    if (!isVisible()) { setTextOpacity(1); commit(); return }
    const elapsed = Date.now() - genStartRef.current
    const wait = Math.max(160, 650 - elapsed)
    setTimeout(() => {
      setTextOpacity(0)
      setTimeout(() => { commit(); requestAnimationFrame(() => setTextOpacity(1)) }, 310)
    }, wait)
  }, [isVisible])

  useEffect(() => {
    if (signature === prevSigRef.current) return
    prevSigRef.current = signature
    pendingRef.current = bullets
    resolvingRef.current = false
    genStartRef.current = Date.now()
    setGenerating(true)
    setClearing(false)  // new content arrived — don't let a stale fade hide fresh marks
    setLastUpdated(new Date())
    tryDeliver()
  }, [signature, tryDeliver])

  useEffect(() => {
    const el = cardRef.current
    let obs = null
    if (el && typeof IntersectionObserver !== 'undefined') {
      obs = new IntersectionObserver((entries) => { const e = entries[0]; if (e) setOnScreen(e.isIntersecting); tryDeliver() }, { threshold: [0, 0.25, 0.5] })
      obs.observe(el)
    } else { setOnScreen(true) }
    let raf = 0
    const onScroll = () => {
      if (pendingRef.current == null || raf) return
      raf = requestAnimationFrame(() => { raf = 0; tryDeliver() })
    }
    window.addEventListener('scroll', onScroll, true)
    return () => { if (obs) obs.disconnect(); window.removeEventListener('scroll', onScroll, true); if (raf) cancelAnimationFrame(raf) }
  }, [tryDeliver])

  useEffect(() => {
    const el = starRef.current
    if (!generating || !el || !el.animate) return
    const anim = el.animate(
      [{ transform: 'scale(1)', opacity: 0.5 }, { transform: 'scale(1.16)', opacity: 1 }, { transform: 'scale(1)', opacity: 0.5 }],
      { duration: 1200, iterations: Infinity, easing: 'ease-in-out' }
    )
    return () => anim.cancel()
  }, [generating])

  // Acknowledge (clear marks) once the patient has actually viewed the card — on screen for a
  // short dwell. Commits the current bullets as "seen"; diffs against last-seen, so changes made
  // between views stay marked until the card is actually looked at.
  useEffect(() => {
    if (!onScreen) return
    let inner
    const t = setTimeout(() => {
      const sig = shownBullets.map(b => b.id + ':' + b.text)
      const hasMarks = shownBullets.some(b => changeOf(b))
      const commit = () => {
        setSeenSet(new Set(sig))
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(sig)) } catch {}
        setClearing(false)
      }
      if (hasMarks) { setClearing(true); inner = setTimeout(commit, 520) }  // fade the marks, then commit
      else commit()
    }, 2200)
    return () => { clearTimeout(t); if (inner) clearTimeout(inner) }
  }, [onScreen, shownBullets, seenSet])

  const textFade = { opacity: textOpacity, transition: 'opacity 0.28s ease' }
  const ctaBtnStyle = { marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', backgroundColor: C.bgApp, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.primary }

  return (
    <div ref={cardRef} style={{ position: 'relative', width: '100%', backgroundColor: C.bgCard, ...SOFT_CARD, padding: '15px 18px', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span ref={starRef} style={{ display: 'inline-flex', transformOrigin: 'center' }}><span className="material-symbols-rounded" style={{ fontSize: 17, ...AI_ICON, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>auto_awesome</span></span>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary }}>Daily summary</span>
      </div>
      {(narrative && narrative.enrich) ? (
        <div style={{ ...textFade, margin: '12px 0 4px' }}>
          <div style={{ fontSize: 14.5, color: C.textPrimary, lineHeight: 1.6 }}>{narrative.text}</div>
          <button onClick={openAdd} style={ctaBtnStyle}>
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: C.primary }}>add</span>Add an event
          </button>
        </div>
      ) : (
        <>
          <div style={{ ...textFade, margin: '12px 0', fontSize: 14.5, color: C.textPrimary, lineHeight: 1.6 }}>{narrative ? narrative.text : ''}</div>
          {teasers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '2px 0 12px' }}>
              {teasers.map(t => (
                <button key={t.id} onClick={(e) => { e.stopPropagation(); onTeaserAction && onTeaserAction(t) }} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', backgroundColor: C.bgApp, border: 'none', borderRadius: 12, padding: '11px 12px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 19, color: C.textSecondary, flexShrink: 0, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{t.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.35 }}>{t.takeaway}</span>
                    {t.basis && <span style={{ display: 'block', fontSize: 11.5, color: C.textTertiary, marginTop: 1 }}>{t.basis}</span>}
                  </span>
                  {t.spark && t.spark.length > 1 && <Sparkline data={t.spark}/>}
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, flexShrink: 0 }}>chevron_right</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={castVote('up')} aria-pressed={vote === 'up'} aria-label="Helpful" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: vote === 'up' ? C.primaryLight : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background-color 0.15s' }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill={vote === 'up' ? C.primary : 'none'}><path d="M1.5 7.5h2v5.5h-2zM3.5 7.5L5.5 3l1.5.5V6.5H11L10 12H3.5z" stroke={vote === 'up' ? C.primary : C.textSecondary} strokeWidth="1.1" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={castVote('down')} aria-pressed={vote === 'down'} aria-label="Not helpful" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: vote === 'down' ? C.primaryLight : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background-color 0.15s' }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill={vote === 'down' ? C.primary : 'none'}><path d="M13.5 7.5h-2V2h2zM11.5 7.5L9.5 12l-1.5-.5V8H4L5 3h6.5z" stroke={vote === 'down' ? C.primary : C.textSecondary} strokeWidth="1.1" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.4 }}>AI-generated from your care plan and recent clinical activity. Accuracy may vary. Last updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.</div>
        </>
      )}
    </div>
  )
}

// ─── NOTES DISPLAY ────────────────────────────────────────────────
// Handles truncation detection: shows "… more" (semibold) overlay when text
// overflows one line, "show less" below when expanded, nothing when it fits.
const NotesDisplay = ({ notes }) => {
  const [open, setOpen] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const textRef = useRef(null)

  useEffect(() => {
    let raf
    const check = () => {
      const el = textRef.current
      if (!el) return
      setTruncated(el.scrollWidth > el.clientWidth)
    }
    // rAF ensures the browser has finished layout before measuring
    raf = requestAnimationFrame(check)
    return () => cancelAnimationFrame(raf)
  }, [notes])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{ marginTop: 2, flexShrink: 0, display: 'flex' }}><Ico.notes/></span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textTertiary, lineHeight: 1.45 }}>
        {open ? (
          <>
            <span style={{ display: 'block', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{notes}</span>
            <button onClick={e => { e.stopPropagation(); setOpen(false) }} style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, border: 'none', background: 'none', cursor: 'pointer', padding: '2px 0 0', display: 'block', textAlign: 'left' }}>
              show less
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <span ref={textRef} style={{ overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 }}>
              {notes}
            </span>
            {truncated && (
              <button onClick={e => { e.stopPropagation(); setOpen(true) }} style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: C.textTertiary, border: 'none', background: 'none', cursor: 'pointer', paddingLeft: 2, whiteSpace: 'nowrap' }}>
                … more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CLINICAL DETAIL INFO SHEET ───────────────────────────────────
const ClinicalDetailInfoSheet = ({ onClose, onEdit }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 280) }
  const handleEdit = () => { setVis(false); setTimeout(() => { onClose(); onEdit() }, 280) }

  return ReactDOM.createPortal(
    <>
      <div onClick={dismiss} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 50, opacity: vis ? 1 : 0, transition: 'opacity 0.28s ease' }}/>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, borderRadius: '18px 18px 0 0', zIndex: 51, transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '12px auto 0' }}/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 6px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, flex: 1, paddingRight: 8 }}>Clinical Details can't be deleted</div>
          <button onClick={dismiss} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}><Ico.close/></button>
        </div>
        <div style={{ padding: '8px 16px 20px', fontSize: 15, color: C.textSecondary, lineHeight: 1.6 }}>
          Clinical Details provide the health information used to personalize your recommendations. Because this information forms part of your clinical baseline, it can't be deleted. If your clinical information changes, update this event to keep your recommendations accurate.
        </div>
        <div style={{ padding: '0 16px 34px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleEdit} style={{ width: '100%', padding: '14px', backgroundColor: C.primary, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Edit Clinical Detail
          </button>
          <button onClick={dismiss} style={{ width: '100%', padding: '14px', backgroundColor: 'transparent', color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── CARD ACTION SHEET ────────────────────────────────────────────
// Bottom sheet (the app's existing slide-up pattern) for event-card overflow actions —
// replaces the flyout. User-added events: red trash "Delete" + centered "Cancel".
// Clinical/onboarding events: "Edit" + a disabled "Delete" with a help affordance + "Cancel".
const CardActionSheet = ({ isOnboarding = false, restoreNote = false, onDelete, onEdit, onInfo, onClose }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = (cb) => { setVis(false); setTimeout(() => { onClose && onClose(); if (cb) cb() }, 260) }
  const row = { display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, textAlign: 'left', color: C.textPrimary, WebkitTapHighlightColor: 'transparent' }
  const ic = (name, color) => <span className="material-symbols-rounded" style={{ fontSize: 20, color }}>{name}</span>
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div onClick={() => dismiss()} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', opacity: vis ? 1 : 0, transition: 'opacity 0.26s ease' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bgCard, borderRadius: '18px 18px 0 0', boxShadow: '0 -6px 24px rgba(0,0,0,0.16)', paddingBottom: 8, transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
        {isOnboarding ? (
          <>
            <button onClick={() => dismiss(onEdit)} style={row}>{ic('edit', C.textPrimary)}Edit</button>
            <div style={{ height: 1, backgroundColor: C.border, margin: '0 20px' }}/>
            <div style={{ ...row, color: 'rgba(239,68,68,0.4)', cursor: 'default', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 13 }}>{ic('delete', 'rgba(239,68,68,0.4)')}Delete</span>
              <button onClick={() => dismiss(onInfo)} aria-label="Why can't I delete this?" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><Ico.question/></button>
            </div>
          </>
        ) : (
          <button onClick={() => dismiss(onDelete)} style={{ ...row, color: '#ef4444' }}>{ic('delete', '#ef4444')}Delete</button>
        )}
        <div style={{ height: 1, backgroundColor: C.border, margin: '4px 0 0' }}/>
        <button onClick={() => dismiss()} style={{ width: '100%', padding: '16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: C.textSecondary, textAlign: 'center' }}>Cancel</button>
      </div>
    </div>,
    document.body
  )
}

// ─── APPOINTMENT CARD ─────────────────────────────────────────────
const AppointmentCard = ({ event, highlightId, onRemove, onEdit }) => {
  const [showRemove, setShowRemove] = useState(false)
  const [showInfoSheet, setShowInfoSheet] = useState(false)
  const isHighlighted = highlightId === event.id

  const openMenu = (e) => {
    e.stopPropagation()
    _closeActiveMenu?.()
    setShowRemove(true)
    _closeActiveMenu = () => setShowRemove(false)
  }

  const dateStr = event.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''
  const timeStr = fmtTime12(event.time)
  const dateTimeLine = [dateStr, timeStr].filter(Boolean).join(' · ')
  const typeLocLine = [event.appointmentType, event.location].filter(Boolean).join(' · ')

  return (
    <div
      style={{ width: '100%', backgroundColor: isHighlighted ? '#E4EEFA' : C.bgCard, border: `1px solid ${isHighlighted ? '#A3B8C9' : 'transparent'}`, borderRadius: 14, padding: '12px 16px', transition: 'background 1.8s ease, border-color 1.8s ease', position: 'relative' }}
      onClick={() => { if (showRemove) { setShowRemove(false); _closeActiveMenu = null } }}>
      {showRemove && <CardActionSheet isOnboarding={event.source === 'onboarding'} onDelete={onRemove} onEdit={() => onEdit && onEdit(event)} onInfo={() => setShowInfoSheet(true)} onClose={() => { setShowRemove(false); _closeActiveMenu = null }}/>}
      {showInfoSheet && <ClinicalDetailInfoSheet onClose={() => setShowInfoSheet(false)} onEdit={() => onEdit && onEdit(event)}/>}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flexShrink: 0, alignSelf: 'center' }}>{railIcon('appointment', 40)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Appointment</span>
            {onRemove && (
              <button onClick={openMenu}
                style={{ padding: '0 2px', background: 'none', border: 'none', cursor: 'pointer', color: C.textSecondary, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>⋮</button>
            )}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.3, marginBottom: dateTimeLine ? 3 : 0 }}>
            {event.name || 'Appointment'}
          </div>
          {dateTimeLine && (
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.45, marginBottom: typeLocLine ? 2 : 0 }}>{dateTimeLine}</div>
          )}
          {typeLocLine && (
            <div style={{ fontSize: 13, color: C.textTertiary, lineHeight: 1.45, marginBottom: event.notes ? 4 : 0 }}>{typeLocLine}</div>
          )}
          {event.notes && <NotesDisplay notes={event.notes}/>}
          {event.source === 'onboarding' && (
            <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 6 }}>Added from Clinical details</div>
          )}
        </div>
      </div>
    </div>
  )
}

const EventCard = ({ event, highlightId, onRemove, onEdit, visibleRecs = [] }) => {
  const [showRemove, setShowRemove] = useState(false)
  const [showInfoSheet, setShowInfoSheet] = useState(false)
  const label = typeLabel[event.type] || 'Event'
  const isHighlighted = highlightId === event.id

  const openMenu = (e) => {
    e.stopPropagation()
    _closeActiveMenu?.()
    setShowRemove(true)
    _closeActiveMenu = () => setShowRemove(false)
  }
  // Check if this item is covered by any currently active recommendation
  const coveringRule = findCoveringRule(event, visibleRecs)
  const du = event.startDate && event.endDate ? fmtDateRange(event.startDate, event.endDate) : event.startDate ? fmtDate(event.startDate) : event.date ? fmtDate(event.date) : ''
  const clar = event.dose || (event.details ? event.details.join(' · ') : null)
  return (
    <div style={{ width: '100%', backgroundColor: isHighlighted ? '#E4EEFA' : C.bgCard, border: `1px solid ${isHighlighted ? '#A3B8C9' : 'transparent'}`, borderRadius: 14, padding: '12px 16px', transition: 'background 1.8s ease, border-color 1.8s ease', position: 'relative' }}
      onClick={() => { if (showRemove) { setShowRemove(false); _closeActiveMenu = null } }}>
      {/* Overflow flyout — portal-rendered so it escapes parent overflow clipping */}
      {showRemove && <CardActionSheet isOnboarding={event.source === 'onboarding'} restoreNote={!!coveringRule} onDelete={onRemove} onEdit={() => onEdit && onEdit(event)} onInfo={() => setShowInfoSheet(true)} onClose={() => { setShowRemove(false); _closeActiveMenu = null }}/>}
      {showInfoSheet && <ClinicalDetailInfoSheet onClose={() => setShowInfoSheet(false)} onEdit={() => onEdit && onEdit(event)}/>}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon — flush left, semantic anchor */}
        <div style={{ flexShrink: 0, alignSelf: 'center' }}>{railIcon(event.type, 40)}</div>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {du && <span style={{ fontSize: 12, color: C.textTertiary }}>{du}</span>}
              {onRemove && <button onClick={openMenu}
                style={{ padding: '0 2px', background: 'none', border: 'none', cursor: 'pointer', color: C.textSecondary, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>⋮</button>}
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.3, marginBottom: clar ? 4 : event.notes ? 5 : 0 }}>{event.name}</div>
      {clar && <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.45, marginBottom: event.notes ? 5 : 0 }}>{clar}</div>}
      {event.notes && <NotesDisplay notes={event.notes}/>}
      {event.source === 'onboarding' && (
        <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 6 }}>Added from Clinical details</div>
      )}
        </div>{/* end content */}
      </div>{/* end icon+content row */}
    </div>
  )
}

const GENERATION_MESSAGES = {
  rcc_s13_step1: 'Generating suggested treatments…',
  rcc_s13_step2: 'Generating suggested treatments…',
  rcc_s4_step1: 'Generating suggested treatments…',
  rcc_s4_step2: 'Generating suggested treatments…',
  treatment: 'Generating suggested treatments…',
  supportive: 'Generating suggested treatments…',
  default: 'Generating suggested treatments…',
}

const CANCER_NAMES = {
  RCC: 'kidney cancer', BREAST: 'breast cancer', CRC: 'colorectal cancer',
  LUNG: 'lung cancer', PROS: 'prostate cancer', BLAD: 'bladder cancer',
  OV: 'ovarian cancer', LEUK: 'leukemia', LYMP: 'lymphoma', MM: 'multiple myeloma',
}

// Build a real, dynamic daily-summary string from the person's timeline (past → present → future)
// and their current recommendations. Reacts to any change in either.
// Returns the AI Daily Summary as the Engineering Spec's structured bullets:
// [{ id, text, source_refs }] with the fixed IDs (plan_status / today / upcoming /
// treatments), in that order, max 4, omitting any bullet with no supporting data.
// Copy follows the O4M plain-language standards (no "your cancer/plan", no staging
// shorthand, no acronyms, no procedure names — surgery/treatment/appointment are fine).
// Prototype note: this is a deterministic stand-in shaped like the spec's contract; the
// real build generates these bullets from an LLM server-side. `source_refs` are populated
// from the real record IDs the engine already has, to mirror the traceability requirement.
const buildDailySummary = (ps, timeline = [], recs = null) => {
  const todayStr = localDateStr()
  const monthName = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' }) } catch { return null } }
  const ref = e => (e && e.id) ? [`event:${e.id}`] : []

  const events = (timeline || []).flatMap(day => (day.events || []).map(e => ({ ...e, _date: day.date, _isToday: !!day.isToday })))
  const nonDx = events.filter(e => e.type !== 'diagnosis')
  const surg = nonDx.find(e => /nephrectomy|prostatectomy|mastectomy|lumpectomy|resection|ablation|surgery/i.test(e.name || ''))
  const path = nonDx.find(e => /patholog/i.test(e.name || ''))
  const todayEvents = nonDx.filter(e => e._isToday)
  const todayAppt = todayEvents.find(e => e.type === 'appointment')
  const todayMed = todayEvents.find(e => e.type === 'medication')
  const todayOther = todayEvents.find(e => e !== todayAppt && e !== todayMed)
  const nextAppt = nonDx
    .filter(e => e.type === 'appointment' && !e._isToday && e._date > todayStr)
    .sort((a, b) => a._date.localeCompare(b._date))[0] || null
  const added = nonDx.filter(e => e.createdFromRecommendationId)

  const bullets = []

  // plan_status — plain-language treatment history. Only emitted when there's real history to
  // state; we do NOT assert an "active treatment plan" we can't verify (surveillance, remission,
  // pre-treatment). When there's nothing to say, the card falls through to its empty state.
  if (surg) {
    const m = monthName(surg._date)
    const text = `You had surgery${m ? ` in ${m}` : ''}${path ? ', and the results have been reviewed' : ''}.`
    bullets.push({ id: 'plan_status', text, source_refs: [...ref(surg), ...ref(path)] })
  }

  // today — only when something is actually scheduled/logged today. Never manufactured.
  {
    let text = null
    const refs = []
    if (todayAppt) {
      const dr = shortDrName(todayAppt.provider || todayAppt.name)
      const at = todayAppt.time ? ` at ${todayAppt.time}` : ''
      text = dr ? `You have an appointment with ${dr} today${at}.` : `You have an appointment today${at}.`
      refs.push(...ref(todayAppt))
    } else if (todayMed) {
      text = `You started ${todayMed.name} today.`
      refs.push(...ref(todayMed))
    } else if (todayOther) {
      text = `Today includes ${todayOther.name.toLowerCase()}.`
      refs.push(...ref(todayOther))
    }
    if (text) bullets.push({ id: 'today', text, source_refs: refs })
  }

  // upcoming — the next scheduled appointment after today.
  if (nextAppt) {
    const dr = shortDrName(nextAppt.provider || nextAppt.name)
    const when = relativeApptDate(nextAppt._date)
    const text = dr ? `Your next appointment with ${dr} is ${when}.` : `Your next appointment is ${when}.`
    bullets.push({ id: 'upcoming', text, source_refs: ref(nextAppt) })
  }

  // treatments — treatments the patient has added from recommendations.
  if (added.length) {
    const text = added.length === 1
      ? `Your plan now includes ${added[0].name.toLowerCase()}.`
      : `Your plan now includes ${added.length} new treatments.`
    bullets.push({ id: 'treatments', text, source_refs: added.flatMap(ref) })
  }

  return bullets.slice(0, 4)
}

// ─── QUESTION CARD ────────────────────────────────────────────────
const QuestionCard = ({ question, group, onAnswer }) => {
  return (
    <div style={{ backgroundColor: C.bgCard, borderRadius: 14, padding: '16px 16px 12px', animation: 'cardfadein 0.4s ease forwards' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Quick question</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4, marginBottom: 6 }}>{question.text}</div>
      {question.subtext && <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>{question.subtext}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.answers.map((ans, i) => (
          <button key={i} onClick={() => onAnswer(group, i, ans)}
            style={{ width: '100%', padding: '11px 14px', backgroundColor: C.bgApp, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, color: C.textPrimary, WebkitTapHighlightColor: 'transparent' }}>
            {ans.label}
          </button>
        ))}
      </div>
    </div>
  )
}


// ─── SUMMARIZE SHEET ─────────────────────────────────────────────
const SummarizeSheet = ({ block, patientState = {}, planItems = [], onClose }) => {
  const [vis, setVis] = useState(false)
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [summary, setSummary] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
  }, [])

  const dismiss = () => { setVis(false); setTimeout(onClose, 320) }

  const optionsList = block.options.map(o => `• ${o.title}: ${o.subtitle || o.description}`).join('\n')
  const stage = patientState.stage ? `Stage ${patientState.stage}` : null
  const histology = patientState.biomarkers?.histology === 'clear-cell' ? 'clear cell RCC' : patientState.biomarkers?.histology ? patientState.biomarkers.histology : null
  const priorTreatments = planItems.filter(e => e.type === 'procedure' || e.type === 'medication').map(e => e.name).slice(0, 5)
  const patientContext = [
    stage,
    histology,
    priorTreatments.length > 0 ? `prior treatments: ${priorTreatments.join(', ')}` : null,
  ].filter(Boolean).join(', ')

  const prompt = `You are a helpful oncology patient navigator. A patient wants to understand what their treatment options mean specifically for them.

Patient profile: ${patientContext || 'not specified'}
Treatment category: ${block.stepLabel}
Context: ${block.stepBody}

Options:
${optionsList}

In 3–5 sentences, explain what these options mean for this specific patient given their profile. Be direct and personal — say "for you" and "given your situation". Highlight which options are most relevant given their profile and why. Do not make a final recommendation — help them understand so they can have an informed conversation with their care team.`

  const runSummary = async () => {
    setStatus('loading')
    setSummary('')
    setErrorMsg('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const text = data.content?.find(b => b.type === 'text')?.text || ''
      setSummary(text)
      setStatus('done')
    } catch (e) {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  useEffect(() => { runSummary() }, [])

  return (
    <>
      {/* Backdrop */}
      <div onClick={dismiss} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 62, opacity: vis ? 1 : 0, transition: 'opacity 0.28s ease' }}/>
      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 63,
        backgroundColor: C.bgCard, borderRadius: '18px 18px 0 0',
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        maxHeight: '72%', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
      }}>
        {/* Handle + header */}
        <div style={{ flexShrink: 0, padding: '12px 16px 0' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.border, margin: '0 auto 14px' }}/>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>For You</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.2px' }}>{block.stepLabel}</div>
            </div>
            <button onClick={dismiss} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
              <Ico.close/>
            </button>
          </div>
          <div style={{ height: 1, backgroundColor: C.border, margin: '12px 0 0' }}/>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>
          {status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[100, 85, 92, 70].map((w, i) => (
                <div key={i} style={{ height: 14, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.06)', width: `${w}%`, animation: 'genpulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }}/>
              ))}
            </div>
          )}

          {status === 'done' && (
            <div style={{ fontSize: 15, color: C.textPrimary, lineHeight: 1.7 }}>{summary}</div>
          )}

          {status === 'error' && (
            <div style={{ textAlign: 'center', paddingTop: 16 }}>
              <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 16 }}>{errorMsg}</div>
              <button onClick={runSummary} style={{ padding: '10px 20px', backgroundColor: C.bgApp, border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary }}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer disclaimer */}
        {status === 'done' && (
          <div style={{ flexShrink: 0, padding: '0 16px 28px' }}>
            <div style={{ height: 1, backgroundColor: C.border, marginBottom: 12 }}/>
            <div style={{ fontSize: 11, color: C.textTertiary, lineHeight: 1.5 }}>
              AI-generated summary for informational purposes. Discuss all treatment decisions with your care team.
            </div>
          </div>
        )}
      </div>
    </>
  )
}


// What the guideline recommendation is built from — named record facts, so the
// suggested treatments show their provenance instead of implying it by adjacency.
// (Deterministic over the record; the honest version of "these come from your history".)
const buildTreatmentBasis = (ps, timeline = []) => {
  const events = (timeline || []).flatMap(d => (d.events || []).map(e => ({ ...e, _date: d.date })))
  const basis = []
  if (events.some(e => e.type === 'diagnosis') || (ps && (ps.cancerType || ps.diagnosis))) basis.push('your diagnosis')
  if (events.some(e => /nephrectomy|prostatectomy|mastectomy|lumpectomy|resection|ablation|surgery/i.test(e.name || ''))) basis.push('your surgery')
  if (events.some(e => e.type === 'scan' || /patholog|scan|biopsy|mri|\bct\b|\bpet\b|panel|result|test/i.test(e.name || ''))) basis.push('your test results')
  if (events.some(e => e.type === 'medication')) basis.push('your current medications')
  return basis
}
const SuggestedBlock = ({ block, defaultOpen = false, onApproachSelect, addedIds = {}, genState = 'idle', onSummarize = null, basis = [] }) => {
  const [open, setOpen] = useState(defaultOpen)
  const [closing, setClosing] = useState(false)
  const toggle = (e) => {
    if (e) e.stopPropagation()
    if (open) { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false) }, 300) }
    else setOpen(true)
  }
  const expanded = open || closing
  const isLast = false
  const isGenerating = genState === 'generating'
  const genMessage = GENERATION_MESSAGES[block.group] || GENERATION_MESSAGES.default
  if (isGenerating) {
    return (
      <div style={{ width: '100%', backgroundColor: C.bgCard, borderRadius: 14, padding: '14px 16px', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'linear-gradient(90deg, transparent 0%, rgba(255,121,88,0.07) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }}/>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, opacity: 0.7 }}>Suggested treatments</div>
        <div style={{ fontSize: 14, color: C.textSecondary, animation: 'genpulse 1.4s ease-in-out infinite' }}>{genMessage}</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 44, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.04)', opacity: 1 - (i-1) * 0.25 }}/>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
    <div data-sugblock="true" onClick={toggle}
      style={{ width: '100%', backgroundColor: expanded ? 'transparent' : C.bgCard, border: 'none', borderRadius: expanded ? 0 : 13, padding: expanded ? '12px 16px' : '12px 16px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.22s, border 0.22s, border-radius 0.22s, padding 0.22s', WebkitTapHighlightColor: 'transparent', userSelect: 'none', outline: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: open ? 10 : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Suggested treatments</div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.2px', color: C.textPrimary }}>{block.stepLabel}</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4, lineHeight: 1.5, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: open ? 999 : 2, overflow: 'hidden' }}>{block.stepBody}</div>

        </div>
        <button onClick={toggle} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: expanded ? 'transparent' : 'rgba(255,121,88,0.1)', border: expanded ? 'none' : `1px solid rgba(255,121,88,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 10, marginTop: 2, transition: 'background 0.22s, border 0.22s' }}>
          <Ico.chevDown open={open}/>
        </button>
      </div>
      {expanded && <div style={{ maxHeight: closing ? '0' : '2000px', overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.4,0,1,1)', margin: '0 -15px', width: 'calc(100% + 30px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Provenance — names what these options are built from, and the living-plan promise */}
          <div style={{ backgroundColor: C.bgCard, borderRadius: 13, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.5 }}>Built from {basis && basis.length ? basis.join(' · ') : 'your diagnosis and profile'}.</div>
              <div style={{ fontSize: 12, color: C.textTertiary, lineHeight: 1.45, marginTop: 3 }}>Add more to your record and these sharpen.</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onSummarize && onSummarize(block) }}
              style={{ height: 32, padding: '0 12px', backgroundColor: C.bgApp, border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.primary, WebkitTapHighlightColor: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14, ...AI_ICON, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>auto_awesome</span>
              Explain my options
            </button>
          </div>
          {block.options.map(opt => {
            return (
              <button key={opt.id} onClick={e => { e.stopPropagation(); onApproachSelect && onApproachSelect(opt) }}
                style={{ width: '100%', backgroundColor: C.bgCard, border: 'none', borderRadius: 13, padding: '13px 15px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'relative' }}>
                <div style={{ flex: 1 }}>
                  {opt.phase && <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{opt.phase}</div>}
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{opt.title}</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45 }}>{opt.subtitle || opt.description}</div>
                </div>
                <Ico.chevRight/>
              </button>
            )
          })}
        </div>
      </div>}
    </div>
    </>
  )
}

const RailItem = ({ icon, isToday, isLast, card }) => {
  const lineColor = isToday ? C.timelineLineToday : C.timelineLine
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 10 }}>
      {/* Rail column */}
      <div style={{ width: 52, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Icon badge */}
        <div style={{ zIndex: 1 }}>{icon}</div>
        {/* Line below badge */}
        {!isLast && <div style={{ width: 2, flex: 1, minHeight: 12, backgroundColor: lineColor, marginTop: 0 }}/>}
      </div>
      {/* Card */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 0 }}>
        {card}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REDESIGN-01 "payoffs" — the record gives back.
// Additive block: action items (rule-derived), the Pending entry shape,
// prepare-for-visit fixture, sponsored slot, the appointment artifact, and the
// Track writers (symptom / dose / journal / pending). Tokens + card/button/
// sheet/flow patterns all match the existing prototype. No existing code moved.
// ═══════════════════════════════════════════════════════════════════════════

// Soft, calm card treatment (redesign-04 "zen" feel): shadow instead of a hard border,
// rounder corners. Spread over a card's own backgroundColor/padding.
const SOFT_CARD = { border: 'none', borderRadius: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)' }

const _today = () => localDateStr()
const _daysBetweenStr = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000)
const relDays = (dateStr) => {
  if (!dateStr) return ''
  const n = _daysBetweenStr(dateStr, _today())
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  return `${n} days ago`
}
const inDays = (dateStr) => {
  const n = _daysBetweenStr(_today(), dateStr)
  if (n <= 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `in ${n} days`
}
const fmtShort = (dateStr) => { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${MONTHS_LABELS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}` }
const fmtRange = (a, b) => `${fmtShort(a)} – ${fmtShort(b)}`

// Symptom + dose vocab for the prototype writers (production would be broader).
const SYMPTOM_CATALOG = ['Fatigue', 'Nausea', 'Pain', 'Headache', 'Fever', 'Diarrhea', 'Constipation', 'Appetite loss', 'Shortness of breath', 'Rash', 'Numbness / tingling', 'Trouble sleeping', 'Anxiety', 'Dizziness']
const SYMPTOM_SEVERITY = ['Mild', 'Moderate', 'Severe']
const SKIP_REASONS = ['Forgot', 'Side effects', 'Ran out', 'Felt better', 'Cost', 'Other']

// Pending kinds → display, the ageing window before they surface as an action item,
// and the label used to resolve them.
const PENDING_KINDS = {
  records: { label: 'Medical records request', icon: 'folder_shared', overdueDays: 10, resolveLabel: 'Mark received' },
  genomic: { label: 'Genomic testing result', icon: 'biotech', overdueDays: 14, resolveLabel: 'Mark received' },
  genetic: { label: 'Genetic counseling referral', icon: 'groups', overdueDays: 21, resolveLabel: 'Mark referred' },
  trial:   { label: 'Clinical trial to discuss', icon: 'science', overdueDays: 0, resolveLabel: 'Mark as raised' },
  'trial-match': { label: 'Clinical trial match (eligible)', icon: 'verified', overdueDays: 0, resolveLabel: 'Mark as discussed' },
}
const PENDING_ORDER = ['records', 'genomic', 'genetic', 'trial', 'trial-match']

// ─── ACTION ITEMS — deterministic rules over state ──────────────────────────
// No model dependency. Must stay correct if the summary is unavailable. Returns
// display items; the caller maps `primary.kind` → a real handler.
const deriveActionItems = ({ timeline = [], pending = [], symptoms = [], doseLogs = [], dismissed = [] }) => {
  const items = []
  const push = (o) => { if (!dismissed.includes(o.id)) items.push(o) }
  const today = _today()

  // 1) Pending items past their window (or any saved trial) → nudge to act.
  pending.filter(p => p.status === 'open').forEach(p => {
    const meta = PENDING_KINDS[p.kind] || {}
    const age = _daysBetweenStr(p.requestedDate, today)
    if (p.kind === 'trial') {
      push({ id: `ai_trial_${p.id}`, icon: 'science', title: `Raise ${p.label} with your care team`, reason: `Saved ${relDays(p.requestedDate)} and not yet marked as raised`, primary: { kind: 'resolvePending', label: meta.resolveLabel, pendingId: p.id } })
    } else if (age >= (meta.overdueDays ?? 14)) {
      push({ id: `ai_pending_${p.id}`, icon: meta.icon || 'schedule', title: `${meta.label} still pending`, reason: `Requested ${relDays(p.requestedDate)}, past the ${meta.overdueDays}-day window`, primary: { kind: 'resolvePending', label: meta.resolveLabel, pendingId: p.id } })
    }
  })

  // 2) Medication started but nothing logged since → prompt a check-in.
  const medEvents = timeline.flatMap(d => (d.events || []).filter(e => e.type === 'medication').map(e => ({ ...e, _date: e.date || d.date })))
  const lastMed = medEvents.slice().sort((a, b) => (a._date || '').localeCompare(b._date || ''))[medEvents.length - 1]
  if (lastMed && lastMed._date && _daysBetweenStr(lastMed._date, today) >= 3) {
    const since = symptoms.filter(s => (s.date || '') >= lastMed._date)
    if (since.length === 0) {
      push({ id: `ai_nosympt_${lastMed.id}`, icon: 'vital_signs', title: `Log how you're feeling on ${lastMed.name}`, reason: `Nothing logged since you started it ${relDays(lastMed._date)}`, primary: { kind: 'logSymptom', label: 'Log a symptom' } })
    }
  }
  return items
}

// Group same-symptom logs on adjacent days into episodes (for the artifact).
const buildEpisodes = (logs) => {
  const byName = {}
  logs.forEach(l => { (byName[l.name] = byName[l.name] || []).push(l) })
  const out = []
  Object.entries(byName).forEach(([name, arr]) => {
    arr.sort((a, b) => a.date.localeCompare(b.date))
    let cur = null
    arr.forEach(l => {
      if (cur && _daysBetweenStr(cur.to, l.date) <= 2) { cur.to = l.date; cur.count++; cur.sevs.push(l.severity) }
      else { if (cur) out.push(cur); cur = { name, from: l.date, to: l.date, count: 1, sevs: [l.severity] } }
    })
    if (cur) out.push(cur)
  })
  const peak = (sevs) => SYMPTOM_SEVERITY[Math.max(...sevs.map(s => Math.max(0, SYMPTOM_SEVERITY.indexOf(s))))]
  return out.map(e => ({ ...e, peak: peak(e.sevs) })).sort((a, b) => b.to.localeCompare(a.to))
}

// ─── ACTION ITEM CARD ───────────────────────────────────────────────────────
const ActionItemCard = ({ item, onPrimary, onDismiss }) => (
  <div style={{ position: 'relative', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px' }}>
    <button onClick={onDismiss} aria-label="Dismiss" style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>close</span>
    </button>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textIcon, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{item.icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{item.title}</div>
        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45, marginBottom: 12 }}>{item.reason}</div>
        <button onClick={onPrimary} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: C.bgApp, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.primary }}>
          {item.primary.label}
        </button>
      </div>
    </div>
  </div>
)

const AllCaughtUp = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
    <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>task_alt</span>
    <span style={{ fontSize: 13, color: C.textTertiary }}>You're all caught up — nothing needs your attention.</span>
  </div>
)

// ─── PENDING CARD (informational; visible until resolved) ───────────────────
const PendingCard = ({ item, onResolve }) => {
  const meta = PENDING_KINDS[item.kind] || {}
  return (
    <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 19, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{meta.icon || 'schedule'}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.textSecondary, backgroundColor: C.bgApp, borderRadius: 9999, padding: '2px 7px', letterSpacing: '0.05em', flexShrink: 0 }}>PENDING</div>
          </div>
          <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>Requested {relDays(item.requestedDate)} · {fmtShort(item.requestedDate)}</div>
        </div>
        <button onClick={onResolve} style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{meta.resolveLabel || 'Resolve'}</button>
      </div>
    </div>
  )
}

// ─── PREPARE-FOR-VISIT (non-dismissible fixture inside Today) ────────────────
const PrepareVisitCard = ({ appt, onPrepare }) => (
  <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textIcon, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>event</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>Upcoming visit</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>{appt.name || 'Appointment'}</div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>{fmtShort(appt.date)} · {inDays(appt.date)}</div>
        <button onClick={onPrepare} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', backgroundColor: C.primary, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#fff', fontVariationSettings: "'FILL' 1, 'wght' 500" }}>description</span>
          Prepare for this visit
        </button>
      </div>
    </div>
  </div>
)

// ─── SPONSORED SLOT (adjacent to the record, labeled, never inside a date group) ──
const SponsoredSlot = ({ ad, onDismiss }) => (
  <div style={{ padding: '4px 16px 8px' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.textTertiary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>Sponsored</div>
    <div style={{ position: 'relative', backgroundColor: '#efeef3', border: `1px dashed ${C.borderMid}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#e2e0e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 22, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{ad.icon || 'campaign'}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{ad.title}</div>
        <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.4, marginTop: 1 }}>{ad.body}</div>
      </div>
      <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chevron_right</span>
    </div>
  </div>
)

// ─── APPOINTMENT ARTIFACT (generic, editable, shareable) ────────────────────
const ArtifactSection = ({ title, children }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{title}</div>
    {children}
  </div>
)
const ArtifactRow = ({ children, onRemove }) => (
  <div style={{ position: 'relative', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, paddingRight: onRemove ? 40 : 14 }}>
    {children}
    {onRemove && (
      <button onClick={onRemove} aria-label="Remove" style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 16, color: C.textTertiary }}>close</span>
      </button>
    )}
  </div>
)

const AppointmentArtifactSheet = ({ appt, timeline, symptoms, doseLogs, medications, pending, questions, onSaveQuestions, onClose }) => {
  // Interval: from the most recent past appointment before this visit → the visit date.
  const end = appt.date
  const pastAppts = (timeline || []).flatMap(d => (d.events || []).filter(e => e.type === 'appointment')).map(e => e.date).filter(dt => dt && dt < end).sort()
  const start = pastAppts.length ? pastAppts[pastAppts.length - 1] : localDateStr(new Date(Date.now() - 30 * 86400000))

  const inRange = (dt) => dt && dt >= start && dt <= end
  const [excluded, setExcluded] = useState({})   // { 'ep:idx':true, 'skip:id':true }
  const [qDraft, setQDraft] = useState('')
  const isEx = (k) => !!excluded[k]
  const toggleEx = (k) => setExcluded(p => ({ ...p, [k]: !p[k] }))

  const episodes = buildEpisodes((symptoms || []).filter(s => inRange(s.date))).filter((_, i) => !isEx('ep:' + i))
  const skips = (doseLogs || []).filter(l => l.status === 'skipped' && inRange(l.date)).filter(l => !isEx('skip:' + l.id))
  const takenCount = (doseLogs || []).filter(l => l.status === 'taken' && inRange(l.date)).length
  const skipCount = skips.length
  const totalDoses = takenCount + skipCount
  const adherencePct = totalDoses ? Math.round((takenCount / totalDoses) * 100) : null
  const openPending = (pending || []).filter(p => p.status === 'open')
  const qs = questions || []

  const addQuestion = () => { if (!qDraft.trim()) return; onSaveQuestions([...qs, { id: 'q_' + Date.now(), text: qDraft.trim(), createdDate: _today() }]); setQDraft('') }
  const removeQuestion = (id) => onSaveQuestions(qs.filter(q => q.id !== id))

  const shareText = () => {
    const L = []
    L.push(`Visit summary — ${appt.name || 'Appointment'}`)
    L.push(`${fmtRange(start, end)}`)
    L.push('')
    L.push('SYMPTOMS')
    if (episodes.length) episodes.forEach(e => L.push(`• ${e.name}: ${e.count === 1 ? fmtShort(e.from) : fmtRange(e.from, e.to)} (${e.count} log${e.count > 1 ? 's' : ''}, peak ${e.peak})`))
    else L.push('• None logged this interval')
    L.push('')
    L.push('MEDICATION ADHERENCE')
    if (adherencePct != null) L.push(`• ${adherencePct}% of logged doses taken (${takenCount}/${totalDoses})`)
    if (skips.length) skips.forEach(s => L.push(`• Skipped ${s.medName} on ${fmtShort(s.date)}${s.reason ? ` — ${s.reason}` : ''}`))
    if (adherencePct == null) L.push('• No doses logged this interval')
    L.push('')
    L.push('QUESTIONS TO ASK')
    if (qs.length) qs.forEach(q => L.push(`• ${q.text}`))
    else L.push('• (none)')
    L.push('')
    L.push('PENDING')
    if (openPending.length) openPending.forEach(p => L.push(`• ${p.label} — requested ${fmtShort(p.requestedDate)}`))
    else L.push('• (none)')
    return L.join('\n')
  }
  const doShare = () => {
    const text = shareText()
    if (navigator.share) navigator.share({ title: 'Visit summary', text }).catch(() => {})
    else { try { navigator.clipboard.writeText(text) } catch {} }
  }

  return (
    <FlowShell onClose={onClose} zIndex={80}>
      {(dismiss, setNav) => {
        return (
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px', backgroundColor: C.bgApp }}>
              <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px', marginBottom: 22 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px' }}>{appt.name || 'Appointment'}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>Visit {fmtShort(appt.date)} · covering {fmtRange(start, end)}</div>
                <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 8, lineHeight: 1.5 }}>Review and edit before sharing. Nothing here is sent to your care team automatically.</div>
              </div>

              <ArtifactSection title="Symptoms this interval">
                {episodes.length ? episodes.map((e, i) => (
                  <ArtifactRow key={'ep' + i} onRemove={() => toggleEx('ep:' + i)}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{e.name}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{e.count === 1 ? fmtShort(e.from) : fmtRange(e.from, e.to)} · {e.count} log{e.count > 1 ? 's' : ''} · peak {e.peak}</div>
                  </ArtifactRow>
                )) : <div style={{ fontSize: 13, color: C.textTertiary, padding: '2px 2px 4px' }}>No symptoms logged this interval.</div>}
              </ArtifactSection>

              <ArtifactSection title="Medication adherence">
                {adherencePct != null ? (
                  <ArtifactRow>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{adherencePct}% of logged doses taken</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{takenCount} taken · {skipCount} skipped ({totalDoses} logged)</div>
                  </ArtifactRow>
                ) : <div style={{ fontSize: 13, color: C.textTertiary, padding: '2px 2px 8px' }}>No doses logged this interval.</div>}
                {skips.map(s => (
                  <ArtifactRow key={s.id} onRemove={() => toggleEx('skip:' + s.id)}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>Skipped {s.medName}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{fmtShort(s.date)}{s.reason ? ` · ${s.reason}` : ''}</div>
                  </ArtifactRow>
                ))}
              </ArtifactSection>

              <ArtifactSection title="Questions to ask">
                {qs.map(q => (
                  <ArtifactRow key={q.id} onRemove={() => removeQuestion(q.id)}>
                    <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.4 }}>{q.text}</div>
                  </ArtifactRow>
                ))}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <input value={qDraft} onChange={e => setQDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addQuestion() }} placeholder="Add a question…" style={{ flex: 1, border: `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '11px 12px', fontSize: 15, color: C.textPrimary, backgroundColor: C.bgCard, outline: 'none', fontFamily: 'Inter,sans-serif' }}/>
                  <button onClick={addQuestion} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 22, backgroundColor: qDraft.trim() ? C.primary : C.bgApp, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 22, color: qDraft.trim() ? '#fff' : C.textTertiary }}>add</span>
                  </button>
                </div>
              </ArtifactSection>

              <ArtifactSection title="Pending">
                {openPending.length ? openPending.map(p => (
                  <ArtifactRow key={p.id}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>Requested {fmtShort(p.requestedDate)}</div>
                  </ArtifactRow>
                )) : <div style={{ fontSize: 13, color: C.textTertiary, padding: '2px 2px 4px' }}>Nothing outstanding.</div>}
              </ArtifactSection>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, borderTop: `1px solid ${C.border}`, padding: '12px 20px 34px' }}>
              <button onClick={doShare} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#fff', fontVariationSettings: "'FILL' 1, 'wght' 500" }}>ios_share</span>
                Share with care team
              </button>
            </div>
          </div>
        )
      }}
    </FlowShell>
  )
}

// ─── TRACK WRITER: SYMPTOM LOG ──────────────────────────────────────────────
const SymptomLogFlow = ({ entry, onClose, onComplete }) => {
  const [step, setStep] = useState(entry ? 1 : 0)
  const [name, setName] = useState(entry?.name || '')
  const [severity, setSeverity] = useState(entry?.severity || 'Mild')
  const [date, setDate] = useState(entry?.date || _today())
  const [notes, setNotes] = useState(entry?.notes || '')
  const [q, setQ] = useState('')
  const list = SYMPTOM_CATALOG.filter(s => s.toLowerCase().includes(q.toLowerCase()))
  return (
    <FlowShell onClose={onClose} zIndex={80} confirmClose={step > 0}>
      {(dismiss, setNav) => {
        if (step === 0) {
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px 16px 8px' }}><SearchInput value={q} onChange={setQ}/></div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
                {list.map(s => (
                  <button key={s} onClick={() => { setName(s); setStep(1) }} style={{ width: '100%', textAlign: 'left', padding: '14px 4px', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 16, color: C.textPrimary, fontFamily: 'Inter,sans-serif' }}>{s}</button>
                ))}
                {q.trim() && !list.some(s => s.toLowerCase() === q.trim().toLowerCase()) && (
                  <button onClick={() => { setName(q.trim()); setStep(1) }} style={{ width: '100%', textAlign: 'left', padding: '14px 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.primary, fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>Add “{q.trim()}”</button>
                )}
              </div>
            </div>
          )
        }
        return (
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 18 }}>{name}</div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>Severity</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {SYMPTOM_SEVERITY.map(s => (
                  <button key={s} onClick={() => setSeverity(s)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${severity === s ? C.primary : C.border}`, backgroundColor: severity === s ? C.primaryLight : C.bgCard, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: severity === s ? C.primary : C.textSecondary, fontFamily: 'Inter,sans-serif' }}>{s}</button>
                ))}
              </div>
              <DateInputField label="When" value={date} onChange={setDate} max={_today()}/>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>Notes (optional)</div>
              <NotesTextarea value={notes} onChange={setNotes} placeholder="Anything worth remembering…"/>
            </div>
            <DockedButton label="Save to record" onClick={() => onComplete({ id: entry?.id || ('sym_' + Date.now()), name, severity, date, notes })}/>
          </div>
        )
      }}
    </FlowShell>
  )
}


// ─── LOG A SYMPTOM (from chat) ──────────────────────────────────────────────────
// Mirrors the production app's "Log a symptom": a full view with ×, date and time, an alphabetical
// checklist; checking a symptom expands Severity, a note and photos; Submit, then the "recommended
// solutions" dialog. Opened from chat it slides up as a full view, pre-filled with the symptom they
// mentioned (checked) and their words in the note. Severity is left to them. Saves to the symptom
// tracker only (no timeline event).
const LOG_SYMPTOM_LIST = ['Abdominal pain','Anxiety','Attention problems','Back pain','Bladder problems','Bone pain','Bruising','Chest pain','Chills','Constipation','Cough','Decreased appetite','Decreased libido','Depression','Diarrhea','Dizziness','Fatigue','Fever','Headache','Hot flashes','Insomnia','Joint pain','Mouth sores','Nausea','Numbness or tingling','Pain','Rash','Shortness of breath','Swelling','Vomiting']
const LOG_SEVERITY = [{ k: 'Mild', bars: 1, c: '#F4A3AE' }, { k: 'Moderate', bars: 2, c: '#EC5C70' }, { k: 'Severe', bars: 3, c: '#E1263C' }, { k: 'Very Severe', bars: 4, c: '#9E1028' }]
const ChatLogSymptomFlow = ({ prefill, onClose, onSubmit }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const startName = prefill && prefill.name && LOG_SYMPTOM_LIST.includes(prefill.name) ? prefill.name : null
  const [checked, setChecked] = useState(() => startName ? { [startName]: { severity: null, note: prefill.note || '' } } : {})
  const [dialog, setDialog] = useState(false)
  const listRef = useRef(null)
  useEffect(() => {
    if (!startName || !listRef.current) return
    const el = listRef.current.querySelector(`[data-sym="${startName}"]`)
    if (el) listRef.current.scrollTop = el.offsetTop - 8
  }, [])
  const now = new Date()
  const when = `Today, ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}  ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  const close = (cb) => { setVis(false); setTimeout(() => cb && cb(), 320) }
  const toggle = (n) => setChecked(prev => { const next = { ...prev }; if (next[n]) delete next[n]; else next[n] = { severity: null, note: '' }; return next })
  const setField = (n, k, v) => setChecked(prev => ({ ...prev, [n]: { ...prev[n], [k]: v } }))
  const names = Object.keys(checked)
  const entries = () => names.map(n => ({ id: 'sym_' + Date.now() + '_' + n.replace(/\W/g, ''), name: n, severity: checked[n].severity || 'Mild', date: _today(), notes: checked[n].note || '' }))
  const bars = (n, c) => <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', height: 18, justifyContent: 'center' }}>{Array.from({ length: n }).map((_, i) => <span key={i} style={{ width: 16, height: 3, borderRadius: 1, backgroundColor: c }}/>)}</span>
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: C.bgCard, display: 'flex', flexDirection: 'column', transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.4s cubic-bezier(0.32,0.72,0,1)', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ padding: 'calc(8px + env(safe-area-inset-top, 0px)) 8px 0' }}>
        <button onClick={() => close(onClose)} aria-label="Close" style={{ width: 44, height: 44, border: 'none', background: '#fff', borderRadius: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="material-symbols-rounded" style={{ fontSize: 24, color: '#414652' }}>close</span></button>
      </div>
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: C.textPrimary, marginBottom: 16 }}>Log a symptom</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(0,0,0,0.38)', borderRadius: 4, padding: '0 12px', height: 48, fontSize: 14, color: C.textPrimary, marginBottom: 8 }}>{when}<span className="material-symbols-rounded" style={{ fontSize: 22, color: C.textSecondary }}>calendar_month</span></div>
      </div>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px 96px', position: 'relative' }}>
        {LOG_SYMPTOM_LIST.map(n => {
          const on = !!checked[n]
          return (
            <div key={n} data-sym={n} style={{ borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => toggle(n)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ width: 20, height: 20, borderRadius: 3, border: on ? 'none' : '2px solid rgba(0,0,0,0.38)', backgroundColor: on ? C.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{on && <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#fff', fontVariationSettings: "'wght' 700" }}>check</span>}</span>
                <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: on ? 600 : 500, color: C.textPrimary }}>{n}</span>
              </button>
              {on && (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ fontSize: 14, lineHeight: '20px', color: C.textSecondary, marginBottom: 8 }}>Severity</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {LOG_SEVERITY.map(sv => {
                      const sel = checked[n].severity === sv.k
                      return <button key={sv.k} onClick={() => setField(n, 'severity', sv.k)} style={{ flex: 1, height: 64, borderRadius: 8, border: `1px solid ${sel ? C.primary : C.border}`, backgroundColor: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, color: C.textSecondary }}>{bars(sv.bars, sv.c)}{sv.k}</button>
                    })}
                  </div>
                  <textarea value={checked[n].note} onChange={e => setField(n, 'note', e.target.value)} placeholder="Add a note" rows={2} style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid rgba(0,0,0,0.38)', backgroundColor: C.bgApp, borderRadius: '4px 4px 0 0', padding: 12, fontSize: 14, lineHeight: '20px', fontFamily: 'inherit', resize: 'none', marginBottom: 12, color: C.textPrimary }}/>
                  <div style={{ fontSize: 14, lineHeight: '20px', color: C.textSecondary, marginBottom: 8 }}>Add photos</div>
                  <div style={{ width: 48, height: 48, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="material-symbols-rounded" style={{ fontSize: 22, color: C.textTertiary }}>add_circle</span></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(rgba(255,255,255,0), #fff 30%)' }}>
        <button disabled={!names.length} onClick={() => setDialog(true)} style={{ width: '100%', height: 44, borderRadius: 9999, border: 'none', backgroundColor: names.length ? C.primary : C.bgApp, color: names.length ? '#fff' : C.textTertiary, fontSize: 16, fontWeight: 600, fontFamily: 'inherit', cursor: names.length ? 'pointer' : 'default' }}>Submit</button>
      </div>
      {dialog && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 5 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 24, padding: '24px 16px 16px', width: '100%', maxWidth: 340, textAlign: 'left' }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FBD3D9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><span className="material-symbols-rounded" style={{ fontSize: 22, color: '#fff' }}>favorite</span></div>
            <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Would you like to see recommended solutions for easing this symptom?</div>
            <div style={{ fontSize: 14, lineHeight: '20px', color: C.textSecondary, marginBottom: 16 }}>Recorded symptoms are not monitored by a healthcare professional. If you are having a severe or life-threatening side effect, please call your doctor or 911.</div>
            <button onClick={() => { const e = entries(); close(() => onSubmit(e, true)) }} style={{ width: '100%', height: 44, borderRadius: 9999, border: 'none', backgroundColor: C.primary, color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 8 }}>Yes, manage symptom</button>
            <button onClick={() => { const e = entries(); close(() => onSubmit(e, false)) }} style={{ width: '100%', height: 44, borderRadius: 9999, border: `1px solid ${C.border}`, backgroundColor: '#fff', color: C.textPrimary, fontSize: 16, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>No thanks</button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

// ─── TRACK WRITER: JOURNAL ──────────────────────────────────────────────────
const JournalFlow = ({ entry, onClose, onComplete }) => {
  const [date, setDate] = useState(entry?.date || _today())
  const [text, setText] = useState(entry?.text || '')
  return (
    <FlowShell onClose={onClose} zIndex={80} confirmClose={!!text.trim() && text.trim() !== (entry?.text || '')}>
      {(dismiss, setNav) => (
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 18 }}>{entry ? 'Edit journal entry' : 'Journal entry'}</div>
            <DateInputField label="Date" value={date} onChange={setDate} max={_today()}/>
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>Entry</div>
            <NotesTextarea value={text} onChange={setText} placeholder="How are you doing today?"/>
          </div>
          <DockedButton label="Save to record" onClick={() => text.trim() && onComplete({ id: entry?.id || ('jrn_' + Date.now()), date, text: text.trim() })} disabled={!text.trim()}/>
        </div>
      )}
    </FlowShell>
  )
}

// ─── TRACK WRITER: DOSE LOG (bottom sheet) ──────────────────────────────────
const DoseLogSheet = ({ medications, preMed, onClose, onSave }) => {
  const [vis, setVis] = useState(false)
  const [med, setMed] = useState(preMed || (medications[0] || null))
  const [status, setStatus] = useState('taken')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(_today())
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const close = (cb) => { setVis(false); setTimeout(() => cb && cb(), 300) }
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 420 }}>
      <div onClick={() => close(onClose)} style={{ position: 'absolute', inset: 0, backgroundColor: vis ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: 'background-color 0.3s ease' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bgCard, borderRadius: '22px 22px 0 0', boxShadow: '0 -6px 28px rgba(0,0,0,0.16)', padding: '10px 20px 30px', transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.34s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '0 auto 16px' }}/>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 16 }}>Log a dose</div>
        {!preMed && medications.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>Medication</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {medications.map(m => (
                <button key={m.id} onClick={() => setMed(m)} style={{ padding: '8px 13px', borderRadius: 9999, border: `1px solid ${med?.id === m.id ? C.primary : C.border}`, backgroundColor: med?.id === m.id ? C.primaryLight : C.bgCard, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: med?.id === m.id ? C.primary : C.textSecondary, fontFamily: 'Inter,sans-serif' }}>{m.name}</button>
              ))}
            </div>
          </div>
        )}
        {med && !preMed && medications.length <= 1 && <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 16 }}>{med.name}</div>}
        {preMed && <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 16 }}>{preMed.name}</div>}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['taken', 'Taken', 'check_circle'], ['skipped', 'Skipped', 'cancel']].map(([v, l, ic]) => (
            <button key={v} onClick={() => setStatus(v)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 10, border: `1px solid ${status === v ? C.primary : C.border}`, backgroundColor: status === v ? C.primaryLight : C.bgCard, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: status === v ? C.primary : C.textSecondary, fontFamily: 'Inter,sans-serif' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 19, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>{ic}</span>{l}
            </button>
          ))}
        </div>
        {status === 'skipped' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>Reason</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SKIP_REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)} style={{ padding: '8px 13px', borderRadius: 9999, border: `1px solid ${reason === r ? C.primary : C.border}`, backgroundColor: reason === r ? C.primaryLight : C.bgCard, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: reason === r ? C.primary : C.textSecondary, fontFamily: 'Inter,sans-serif' }}>{r}</button>
              ))}
            </div>
          </div>
        )}
        <DateInputField label="When" value={date} onChange={setDate} max={_today()}/>
        <button onClick={() => med && close(() => onSave({ id: 'dose_' + Date.now(), medId: med.id, medName: med.name, date, status, reason: status === 'skipped' ? reason : '' }))} style={{ width: '100%', height: 52, borderRadius: 9999, backgroundColor: med ? C.primary : C.bgApp, border: 'none', cursor: med ? 'pointer' : 'default', fontSize: 16, fontWeight: 700, color: med ? '#fff' : C.textTertiary, marginTop: 4, fontFamily: 'Inter,sans-serif' }}>Save to record</button>
      </div>
    </div>,
    document.body
  )
}

// ─── WRITER: RECORD SOMETHING YOU'RE WAITING ON (pending) ───────────────────
const PendingFlow = ({ onClose, onComplete }) => {
  const [kind, setKind] = useState('')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(_today())
  return (
    <FlowShell onClose={onClose} zIndex={80} confirmClose={!!kind}>
      {(dismiss, setNav) => (
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 6 }}>Waiting on something?</div>
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5, marginBottom: 18 }}>Track a request so it stays in front of you until it resolves.</div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>What are you waiting on?</div>
            {PENDING_ORDER.map(k => {
              const meta = PENDING_KINDS[k]
              const on = kind === k
              return (
                <button key={k} onClick={() => { setKind(k); if (!label) setLabel(meta.label) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, border: `1px solid ${on ? C.primary : C.border}`, backgroundColor: on ? C.primaryLight : C.bgCard, cursor: 'pointer', marginBottom: 8, fontFamily: 'Inter,sans-serif' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 22, color: on ? C.primary : C.textSecondary }}>{meta.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: on ? C.primary : C.textPrimary }}>{meta.label}</span>
                </button>
              )
            })}
            {kind && (
              <div style={{ marginTop: 12 }}>
                <TextInputField label="Label" value={label} onChange={setLabel} placeholder="e.g. KEYNOTE-564 trial"/>
                <DateInputField label="Requested / saved on" value={date} onChange={setDate} max={_today()}/>
              </div>
            )}
          </div>
          <DockedButton label="Add to next steps" disabled={!kind || !label.trim()} onClick={() => kind && label.trim() && onComplete({ id: 'pend_' + Date.now(), kind, label: label.trim(), createdDate: date, state: 'todo' })}/>
        </div>
      )}
    </FlowShell>
  )
}

// ─── TRACK: SYMPTOMS PANEL (replaces the "coming soon" stub) ────────────────
const SymptomsPanel = ({ symptoms, onAdd }) => {
  const sorted = (symptoms || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingTop: 60, paddingBottom: 100, position: 'relative', backgroundColor: C.bgCard }}>
      {sorted.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 38, color: '#6366f1', fontVariationSettings: "'FILL' 0, 'wght' 300" }}>vital_signs</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px' }}>Track your symptoms</div>
          <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, maxWidth: 260 }}>Log how you're feeling over time. Entries write to your record and feed your visit summary.</div>
          <button onClick={onAdd} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, height: 50, paddingLeft: 24, paddingRight: 24, borderRadius: 25, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'white' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>add</span>Log a symptom
          </button>
        </div>
      ) : (
        <div style={{ paddingBottom: 90 }}>
          <div style={{ padding: '20px 16px 8px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary }}>Logged symptoms</div>
          {sorted.map(s => (
            <div key={s.id} style={{ margin: '0 16px 10px', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.textTertiary, flexShrink: 0 }}>{fmtShort(s.date)}</div>
              </div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{s.severity}{s.notes ? ` · ${s.notes}` : ''}</div>
            </div>
          ))}
        </div>
      )}
      {sorted.length > 0 && (
        <button onClick={onAdd} style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8, height: 52, paddingLeft: 20, paddingRight: 24, borderRadius: 26, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>add</span>Symptom
        </button>
      )}
    </div>
  )
}

// ─── TRACK: JOURNAL PANEL (thin) ────────────────────────────────────────────
const JournalPanel = ({ journal, onAdd }) => {
  const sorted = (journal || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingTop: 60, paddingBottom: 100, position: 'relative', backgroundColor: C.bgCard }}>
      {sorted.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 38, color: C.textIcon, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>edit_note</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px' }}>Journal</div>
          <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, maxWidth: 260 }}>Free-text notes, kept on your record for you.</div>
          <button onClick={onAdd} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, height: 50, paddingLeft: 24, paddingRight: 24, borderRadius: 25, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'white' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>add</span>New entry
          </button>
        </div>
      ) : (
        <div style={{ paddingBottom: 90 }}>
          <div style={{ padding: '20px 16px 8px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary }}>Journal</div>
          {sorted.map(j => (
            <div key={j.id} style={{ margin: '0 16px 10px', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 14px' }}>
              <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 4 }}>{fmtShort(j.date)}</div>
              <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{j.text}</div>
            </div>
          ))}
        </div>
      )}
      {sorted.length > 0 && (
        <button onClick={onAdd} style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8, height: 52, paddingLeft: 20, paddingRight: 24, borderRadius: 26, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>add</span>Entry
        </button>
      )}
    </div>
  )
}

// ─── RESOURCES / LIBRARY CONTENT (populated per the production audit) ────────
const LIBRARY_CONTENT = [
  { category: 'Dictionary', icon: 'menu_book', items: [
    { title: 'Adjuvant therapy', sub: 'Treatment given after the main treatment to lower recurrence risk.' },
    { title: 'Biomarker', sub: 'A measurable indicator used to guide diagnosis and treatment.' },
    { title: 'Metastasis', sub: 'The spread of cancer from where it started to other parts of the body.' },
    { title: 'NCCN Guidelines', sub: 'Consensus treatment standards from the National Comprehensive Cancer Network.' },
  ]},
  { category: 'FAQs', icon: 'help', items: [
    { title: 'What should I bring to my first oncology visit?', sub: 'Records, medication list, and questions — your visit summary covers all three.' },
    { title: 'How are treatment options decided?', sub: 'Diagnosis details, stage, biomarkers, and your preferences, against the guidelines.' },
    { title: 'What is a clinical trial?', sub: 'A research study testing new approaches; eligibility is matched to your profile.' },
  ]},
  { category: 'Webinars', icon: 'smart_display', items: [
    { title: 'Understanding your pathology report', sub: '38 min · with an oncology nurse navigator' },
    { title: 'Managing treatment side effects', sub: '45 min · patient panel + pharmacist' },
    { title: 'Talking to your care team', sub: '29 min · communication strategies' },
  ]},
  { category: 'News', icon: 'newspaper', items: [
    { title: 'FDA updates on targeted therapies', sub: 'Recent approvals relevant to solid tumors.' },
    { title: 'Advances in genomic testing', sub: 'What broader panels mean for treatment matching.' },
  ]},
]
const ResourcesLibraryScreen = () => {
  const [cat, setCat] = useState('Dictionary')
  const active = LIBRARY_CONTENT.find(c => c.category === cat) || LIBRARY_CONTENT[0]
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: C.bgCard, paddingTop: 60 }}>
      <SegmentedControl tabs={LIBRARY_CONTENT.map(c => ({ id: c.category, label: c.category }))} active={cat} onChange={setCat}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 90px', backgroundColor: C.bgApp }}>
        {active.items.map((it, i) => (
          <button key={i} style={{ width: '100%', textAlign: 'left', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 14px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, fontFamily: 'Inter,sans-serif' }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textIcon, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{active.icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{it.title}</div>
              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45 }}>{it.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REDESIGN-02 "check-in + to-dos" — Today's imperative layer, split by horizon.
// Check-in = the daily recurring habit (a launchpad into existing trackers).
// To-dos   = one-time consequential steps (pass-1 action items + folded pending
//            + prepare-for-visit). Additive; matches existing tokens.
// ═══════════════════════════════════════════════════════════════════════════

// ─── MOOD (placeholder capture — production uses the full mood tracker) ─────
const MOOD_SCALE = [
  { v: 1, face: 'sentiment_very_dissatisfied', label: 'Rough' },
  { v: 2, face: 'sentiment_dissatisfied', label: 'Low' },
  { v: 3, face: 'sentiment_neutral', label: 'Okay' },
  { v: 4, face: 'sentiment_satisfied', label: 'Good' },
  { v: 5, face: 'sentiment_very_satisfied', label: 'Great' },
]
const MoodFlow = ({ onClose, onComplete }) => {
  const t = usePatientCopy()
  const [val, setVal] = useState(null)
  const [date, setDate] = useState(_today())
  const [note, setNote] = useState('')
  return (
    <FlowShell onClose={onClose} zIndex={80} confirmClose={val != null}>
      {(dismiss, setNav) => (
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 4 }}>{t('How {are|is} {they} feeling today?')}</div>
            <div style={{ fontSize: 12.5, color: C.textTertiary, marginBottom: 22, lineHeight: 1.4 }}>Placeholder mood check-in — production uses the full mood tracker.</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 22 }}>
              {MOOD_SCALE.map(m => (
                <button key={m.v} onClick={() => setVal(m.v)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0', borderRadius: 12, border: `1px solid ${val === m.v ? C.primary : C.border}`, backgroundColor: val === m.v ? C.primaryLight : C.bgCard, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 29, color: val === m.v ? C.primary : C.textSecondary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>{m.face}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: val === m.v ? C.primary : C.textTertiary }}>{m.label}</span>
                </button>
              ))}
            </div>
            <DateInputField label="When" value={date} onChange={setDate} max={_today()}/>
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>Note (optional)</div>
            <NotesTextarea value={note} onChange={setNote} placeholder="Anything about today…"/>
          </div>
          <DockedButton label="Save to record" disabled={val == null} onClick={() => val != null && onComplete({ id: 'mood_' + Date.now(), date, value: val, label: MOOD_SCALE.find(m => m.v === val)?.label, note })}/>
        </div>
      )}
    </FlowShell>
  )
}

// ─── CHECK-IN HUB (daily; launches existing trackers; check reflects the record) ──
const CheckIcon = ({ done, pop }) => (
  <div style={{ width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: done ? 'none' : `2px solid ${C.border}`, backgroundColor: done ? '#34a853' : 'transparent', animation: pop ? 'o4mCheckPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none' }}>
    {done && <span className="material-symbols-rounded" style={{ fontSize: 15, color: '#fff', fontVariationSettings: "'FILL' 1, 'wght' 600" }}>check</span>}
  </div>
)
const _ciBadge = { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const _ciBadgeIcon = { fontSize: 19, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }
// Daily journaling prompt — rotates each day (honors the dev day-offset) to nudge a journal entry.
// Patient-copy templates (services/patientCopy.js). About the patient → tokens; about the
// person writing (their mind, their self-care) → plain "you". journalPrompt() returns a
// template; callers fill it.
const JOURNAL_PROMPTS = [
  'How {are|is} {they} feeling today?',
  "What's on your mind today?",
  'What went well today?',
  'What felt hard today?',
  "What's one thing to remember about today?",
  'What are you grateful for today?',
  'How is {their} energy today?',
  'What {do you|does {they}} need today?',
  'Any questions for your care team?',
  "What's something you're hopeful about?",
  'How did you take care of yourself today?',
  'What would you tell a friend going through this?',
  "What's one small win from today?",
  'What are you carrying today?',
]
const journalPrompt = () => {
  let off = 0; try { off = parseInt(localStorage.getItem('o4m_dev_day_offset') || '0', 10) || 0 } catch (e) {}
  const d = new Date(); d.setDate(d.getDate() + off)
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
  return JOURNAL_PROMPTS[((doy % JOURNAL_PROMPTS.length) + JOURNAL_PROMPTS.length) % JOURNAL_PROMPTS.length]
}
const CheckInCard = ({ state, justChecked, moodLabel, count = 0, onMood, onSymptomsYes, onSymptomsNo, onJournal }) => {
  const t = usePatientCopy()
  const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0' }
  const withDiv = { ...row, borderBottom: `1px solid ${C.border}` }
  const lbl = (done) => ({ fontSize: 14.5, fontWeight: 600, color: done ? C.textTertiary : C.textPrimary })
  const sub = { fontSize: 12.5, color: C.textSecondary, marginTop: 1 }
  const subDone = { fontSize: 12, color: C.textTertiary, marginTop: 1 }
  return (
    <div style={{ backgroundColor: C.bgCard, ...SOFT_CARD, padding: '6px 18px 10px' }}>
      <div style={{ padding: '13px 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary }}>Today's check-in</div>
          {count > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: C.bgApp, borderRadius: 9999, padding: '3px 9px', flexShrink: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: C.textSecondary, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>event_available</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.textSecondary }}>{count} check-in{count > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: C.textTertiary, marginTop: 2, lineHeight: 1.4 }}>{t("A minute a day builds {their} daily log, revealing patterns you'd otherwise miss.")}</div>
      </div>

      {/* Mood */}
      <div onClick={onMood} style={{ ...withDiv, cursor: 'pointer' }}>
        <div style={_ciBadge}><span className="material-symbols-rounded" style={_ciBadgeIcon}>mood</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={lbl(state.mood)}>Mood</div>
          <div style={state.mood ? subDone : sub}>{state.mood ? (moodLabel ? `Feeling ${moodLabel.toLowerCase()}` : 'Logged today') : t('How {are|is} {they} feeling today?')}</div>
        </div>
        <CheckIcon done={state.mood} pop={justChecked === 'mood'}/>
      </div>

      {/* Symptoms — Yes launches the logger, No marks nothing-to-report; once done, tap to add another */}
      <div onClick={state.symptoms ? onSymptomsYes : undefined} style={{ ...withDiv, cursor: state.symptoms ? 'pointer' : 'default' }}>
        <div style={_ciBadge}><span className="material-symbols-rounded" style={_ciBadgeIcon}>vital_signs</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={lbl(!!state.symptoms)}>Symptoms</div>
          <div style={state.symptoms ? subDone : sub}>{state.symptoms ? (state.symptoms === 'none' ? 'None today' : 'Logged today') : 'Any symptoms today?'}</div>
        </div>
        {state.symptoms
          ? <CheckIcon done pop={justChecked === 'symptoms'}/>
          : (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={onSymptomsNo} style={{ padding: '7px 14px', borderRadius: 9999, border: `1px solid ${C.border}`, background: C.bgCard, fontSize: 13, fontWeight: 700, color: C.textSecondary, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>No</button>
              <button onClick={onSymptomsYes} style={{ padding: '7px 14px', borderRadius: 9999, border: 'none', background: C.bgApp, fontSize: 13, fontWeight: 700, color: C.primary, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Yes</button>
            </div>
          )}
      </div>

      {/* Journal — no out; only checks when an entry exists; tap to add/edit */}
      <div onClick={onJournal} style={{ ...row, cursor: 'pointer' }}>
        <div style={_ciBadge}><span className="material-symbols-rounded" style={_ciBadgeIcon}>edit_note</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={lbl(state.journal)}>Journal</div>
          <div style={state.journal ? subDone : sub}>{state.journal ? 'Added today' : t(journalPrompt())}</div>
        </div>
        <CheckIcon done={state.journal} pop={justChecked === 'journal'}/>
      </div>
    </div>
  )
}

// ─── TO-DOS (one-time consequential steps; folds pending + prepare-for-visit) ──
// Next steps as process-starters with a lifecycle: todo → awaiting → resolved.
// Resolution source per kind: records/genomic resolve on an authoritative signal
// (records sync / results arriving — simulated by the day-rollover); genetic/trial
// are unobservable, so they resolve via a confirmation that captures the outcome.
const NEXT_STEP_KINDS = {
  // Titles/reasons are patient-copy templates — NextStepRowContent fills them.
  records: { icon: 'folder_shared', title: 'Connect {their} medical records', reason: 'So your care team sees {their} full history in one place.', start: 'Connect', awaiting: 'Syncing your records…', resolve: 'signal' },
  genomic: { icon: 'biotech', title: 'Check genomic testing eligibility', reason: 'Genomic results can unlock targeted treatment options.', start: 'Start', awaiting: 'Awaiting results', resolve: 'signal' },
  genetic: { icon: 'groups', title: 'Consider genetic counseling', reason: 'A counselor can assess inherited risk for {you and your|{their}} family.', start: 'Start', awaiting: 'Referral in progress', resolve: 'confirm' },
  trial:   { icon: 'science', title: 'Discuss a clinical trial', reason: 'Worth raising with {their} oncologist at the next visit.', start: 'Add to visit prep', awaiting: 'In your visit prep', resolve: 'confirm' },
  // Unanswered questions — each says what it unlocks; one tap opens just that question.
  'q-type':      { icon: 'search',         title: 'Add {their} cancer type to start your plan', reason: "It's what lines up guidance and next steps that fit {they}.", start: 'Add it' },
  'q-stage':     { icon: 'tune',           title: 'Add {their} stage to sharpen your plan',     reason: 'Knowing where it is lets us match guidance to {their} situation.', start: 'Add it' },
  'q-drivers':   { icon: 'biotech',        title: "Tell us what's driving {their} cancer",      reason: 'Biomarkers or gene changes can open up more options — we\u2019ll match more.', start: 'Answer' },
  'q-treatment': { icon: 'event_note',     title: 'Tell us where {they} {are|is} in treatment',  reason: 'So your next steps fit where {they} {are|is} right now.', start: 'Answer' },
  'trial-match': { icon: 'verified', title: "{They're} eligible for a clinical trial", reason: 'A newly opened trial matches {their} profile.', start: 'See the match', awaiting: 'Shared with your care team', resolve: 'confirm', eligible: true },
}
// Migrate the old {status:'open'|'resolved'} shape to the {state} machine.
const _normalizePending = (arr) => (arr || []).map(p => p.state ? p : ({ ...p, state: p.status === 'resolved' ? 'resolved' : 'todo' }))
const deriveTodos = ({ pending = [], upcomingAppt = null }) => {
  const todos = []
  if (upcomingAppt) todos.push({ id: 'todo_visit', kind: 'prepare-visit', appt: upcomingAppt })
  const open = pending.filter(p => p.state === 'todo' || p.state === 'awaiting')
  // an eligible trial match is high-value/novel — rank it up among the next steps
  open.sort((a, b) => (b.kind === 'trial-match' ? 1 : 0) - (a.kind === 'trial-match' ? 1 : 0))
  open.forEach(p => todos.push({ id: p.id, kind: p.kind, state: p.state, startedDate: p.startedDate, label: p.label }))
  return todos
}
const NextStepEyebrow = () => <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, opacity: 0.85 }}>Recommended next step</div>
// v3.13 (Apple-style tint): orange marks only what you can tap. Primary: orange fill, white label.
// Secondary: gray fill (GRAY_100), orange label. Tertiary: orange text. Content icons are neutral.
const Q_DARK = '#162937'
// Inside Today's check-in, the open row's action is its primary (orange, 36) until it's done; "None today"
// and the edits after (Edit symptoms, Edit note) are secondary (v3.14).
const _ciPrimary = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, padding: '0 14px', boxSizing: 'border-box', border: 'none', borderRadius: 9999, background: C.primary, fontSize: 14, lineHeight: '16px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }
const _qLink = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, padding: '0 14px', boxSizing: 'border-box', border: 'none', borderRadius: 9999, background: C.bgApp, fontSize: 14, lineHeight: '16px', fontWeight: 600, color: C.primary, cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }
const _nsBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', boxSizing: 'border-box', backgroundColor: C.bgApp, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 14, lineHeight: '16px', fontWeight: 600, color: C.primary, fontFamily: 'Inter,sans-serif' }
const TodoItem = ({ item, onAction }) => {
  const t = usePatientCopy()
  const card = { backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px' }
  const badge = (dim) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })

  if (item.kind === 'prepare-visit') {
    return (
      <div style={card}>
        <NextStepEyebrow/>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={badge(false)}><span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textSecondary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>event</span></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{t('Prepare for {their} visit')}</div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45, marginBottom: 12 }}>{item.appt.name || 'Appointment'} · {inDays(item.appt.date)}</div>
            <button onClick={() => onAction(item)} style={_nsBtn}>Prepare</button>
          </div>
        </div>
      </div>
    )
  }

  const cfg = NEXT_STEP_KINDS[item.kind] || { icon: 'schedule', title: item.kind, reason: '', start: 'Start', awaiting: 'In progress', resolve: 'signal' }
  const awaiting = item.state === 'awaiting'
  return (
    <div style={card}>
      <NextStepEyebrow/>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={badge(awaiting)}><span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{cfg.icon}</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{t(cfg.title)}</div>
          {awaiting ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: cfg.resolve === 'confirm' ? 12 : 2 }}>
                <span style={{ width: 13, height: 13, borderRadius: 7, border: `2px solid ${C.border}`, borderTopColor: C.textSecondary, display: 'inline-block', animation: 'o4mSpin 0.8s linear infinite', flexShrink: 0 }}/>
                <span style={{ fontSize: 13, color: C.textSecondary }}>{cfg.awaiting}</span>
              </div>
              {cfg.resolve === 'confirm' && <button onClick={() => onAction(item)} style={_nsBtn}>Mark done</button>}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45, marginBottom: 12 }}>{t(cfg.reason)}</div>
              <button onClick={() => onAction(item)} style={_nsBtn}>{cfg.start}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
const ConfirmOutcomeSheet = ({ item, onClose, onConfirm }) => {
  const t = usePatientCopy()
  const [vis, setVis] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const close = (cb) => { setVis(false); setTimeout(() => cb && cb(), 300) }
  const cfg = NEXT_STEP_KINDS[item.kind] || {}
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 420 }}>
      <div onClick={() => close(onClose)} style={{ position: 'absolute', inset: 0, backgroundColor: vis ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: 'background-color 0.3s ease' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bgCard, borderRadius: '22px 22px 0 0', boxShadow: '0 -6px 28px rgba(0,0,0,0.16)', padding: '10px 20px 30px', transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.34s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '0 auto 16px' }}/>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 4 }}>{t(cfg.title) || 'Mark as done'}</div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>Capture what came of it — this feeds your visit summary.</div>
        <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>What was decided? (optional)</div>
        <NotesTextarea value={note} onChange={setNote} placeholder="e.g. Referred to genetic counseling"/>
        <button onClick={() => close(() => onConfirm(item.id, note))} style={{ width: '100%', height: 52, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 4, fontFamily: 'Inter,sans-serif' }}>Mark done</button>
      </div>
    </div>,
    document.body
  )
}

// ─── DAILY LOG (read-only past-day record; derived from the stores) ─────────
const _MOOD_FACE = { 1: 'sentiment_very_dissatisfied', 2: 'sentiment_dissatisfied', 3: 'sentiment_neutral', 4: 'sentiment_satisfied', 5: 'sentiment_very_satisfied' }
const DailyLogGroup = ({ mood, symptoms = [], journal = [], none = false }) => {
  const badge = { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  const icon = { fontSize: 17, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0' }
  const primary = { fontSize: 14, color: C.textPrimary }
  const secondary = { fontSize: 12.5, color: C.textTertiary }
  return (
    <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '4px 16px 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 0 2px' }}>Daily log</div>
      {mood && (
        <div style={rowStyle}>
          <div style={badge}><span className="material-symbols-rounded" style={{ ...icon, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>{_MOOD_FACE[mood.value] || 'mood'}</span></div>
          <div style={{ flex: 1, minWidth: 0 }}><span style={primary}>Felt {(mood.label || '').toLowerCase()}</span>{mood.note ? <span style={secondary}> · {mood.note}</span> : null}</div>
        </div>
      )}
      {symptoms.map(s => (
        <div key={s.id} style={rowStyle}>
          <div style={badge}><span className="material-symbols-rounded" style={icon}>vital_signs</span></div>
          <div style={{ flex: 1, minWidth: 0 }}><span style={primary}>{s.name}</span><span style={secondary}> · {s.severity}{s.notes ? ` · ${s.notes}` : ''}</span></div>
        </div>
      ))}
      {(!symptoms.length && none) && (
        <div style={rowStyle}>
          <div style={badge}><span className="material-symbols-rounded" style={icon}>vital_signs</span></div>
          <div style={{ flex: 1, minWidth: 0 }}><span style={secondary}>No symptoms reported</span></div>
        </div>
      )}
      {journal.map(j => (
        <div key={j.id} style={rowStyle}>
          <div style={badge}><span className="material-symbols-rounded" style={icon}>edit_note</span></div>
          <div style={{ flex: 1, minWidth: 0 }}><span style={{ ...primary, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden', lineHeight: 1.45 }}>{j.text}</span></div>
        </div>
      ))}
    </div>
  )
}

// One grouped "Recommended next steps" card (rows divided), symmetric with the check-in
// card — replaces the per-item cards + repeated eyebrows.
const NextStepRowContent = ({ item, onAction }) => {
  const t = usePatientCopy()
  const badge = { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  const title = { fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }
  const sub = { fontSize: 13, color: C.textSecondary, lineHeight: 1.45 }
  if (item.kind === 'prepare-visit') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={badge}><span className="material-symbols-rounded" style={{ fontSize: 19, color: C.textSecondary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>event</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={title}>{t('Prepare for {their} visit')}</div>
          <div style={{ ...sub, marginBottom: 12 }}>{item.appt.name || 'Appointment'} · {inDays(item.appt.date)}</div>
          <button onClick={() => onAction(item)} style={_nsBtn}>Prepare</button>
        </div>
      </div>
    )
  }
  const cfg = NEXT_STEP_KINDS[item.kind] || { icon: 'schedule', title: item.kind, reason: '', start: 'Start', awaiting: 'In progress', resolve: 'signal' }
  const awaiting = item.state === 'awaiting'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={badge}><span className="material-symbols-rounded" style={{ fontSize: 19, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{cfg.icon}</span></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{t(cfg.title)}</span>
          {cfg.eligible && <span style={{ fontSize: 10, fontWeight: 700, color: '#1c7a4f', backgroundColor: '#e6f4ec', borderRadius: 9999, padding: '2px 8px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Eligible</span>}
        </div>
        {awaiting ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: cfg.resolve === 'confirm' ? 12 : 0 }}>
              <span style={{ width: 13, height: 13, borderRadius: 7, border: `2px solid ${C.border}`, borderTopColor: C.textSecondary, display: 'inline-block', animation: 'o4mSpin 0.8s linear infinite', flexShrink: 0 }}/>
              <span style={{ fontSize: 13, color: C.textSecondary }}>{cfg.awaiting}</span>
            </div>
            {cfg.resolve === 'confirm' && <button onClick={() => onAction(item)} style={_nsBtn}>Mark done</button>}
          </div>
        ) : (
          <div>
            <div style={{ ...sub, marginBottom: 12 }}>{item.kind === 'trial-match' && item.label ? t(`${item.label} · newly opened, matches {their} profile.`) : t(cfg.reason)}</div>
            <button onClick={() => onAction(item)} style={_nsBtn}>{cfg.start}</button>
          </div>
        )}
      </div>
    </div>
  )
}
const NextStepsSection = ({ todos = [], onAction }) => {
  const cardShell = { backgroundColor: C.bgCard, ...SOFT_CARD, padding: '16px' }
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary, padding: '2px 2px 10px' }}>Recommended next steps</div>
      {todos.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {todos.map(t => <div key={t.id} style={cardShell}><NextStepRowContent item={t} onAction={onAction}/></div>)}
        </div>
      ) : (
        <div style={{ ...cardShell, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>task_alt</span>
          <span style={{ fontSize: 13.5, color: C.textSecondary }}>You're all caught up — nothing to act on today.</span>
        </div>
      )}
    </div>
  )
}
const NextStepsCard = ({ todos = [], onAction }) => (
  <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '4px 16px 8px' }}>
    <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary, padding: '13px 0 4px' }}>Recommended next steps</div>
    {todos.length ? todos.map((t, i) => (
      <div key={t.id} style={{ padding: '14px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
        <NextStepRowContent item={t} onAction={onAction}/>
      </div>
    )) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 14px' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>task_alt</span>
        <span style={{ fontSize: 13.5, color: C.textSecondary }}>You're all caught up — nothing to act on today.</span>
      </div>
    )}
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// REDESIGN-03 "the loop" — the daily summary as teaser/gateway. It reads the
// check-in (its input) and points at the next steps (its output): status line +
// top 1–2 ranked teaser items, each an inline takeaway that drills into the
// durable surface where the full thing lives. Insight candidates are deterministic
// over logged data (simulated-smart) until a real model + trends view exist.
// ═══════════════════════════════════════════════════════════════════════════
const _weekIdx = (dateStr) => { const d = new Date(dateStr + 'T12:00:00'), now = new Date(localDateStr() + 'T12:00:00'); return Math.floor((now - d) / (7 * 86400000)) }
const Sparkline = ({ data, w = 46, h = 18, color }) => {
  if (!data || data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data), range = (max - min) || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 1 - ((v - min) / range) * (h - 2)}`).join(' ')
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0, overflow: 'visible' }}><polyline points={pts} fill="none" stroke={color || C.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
const buildTeasers = ({ symptoms = [], mood = [], doseLogs = [], pending = [], upcomingAppt = null, visibleRecs = null }) => {
  const out = []
  const today = _today()
  // Insight — symptom frequency trend (weekly buckets over ~4 weeks) for the most-logged symptom
  const rs = symptoms.filter(s => s.date && _daysBetweenStr(s.date, today) <= 27)
  if (rs.length >= 3) {
    const by = {}; rs.forEach(s => { by[s.name] = (by[s.name] || 0) + 1 })
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0][0]
    const weeks = [0, 0, 0, 0]; rs.filter(s => s.name === top).forEach(s => { weeks[3 - Math.min(3, _weekIdx(s.date))] += 1 })
    const rising = weeks[3] > 0 && (weeks[3] + weeks[2]) >= (weeks[0] + weeks[1])
    out.push({ id: 'insight_symptom', type: 'insight', icon: 'vital_signs', takeaway: `${top} has come up more often lately`, basis: 'Based on your check-ins over the last few weeks', spark: weeks, score: 60 + (rising ? 20 : 0) })
  }
  // Insight — mood trend (weekly average)
  const rm = mood.filter(m => m.date && _daysBetweenStr(m.date, today) <= 27 && typeof m.value === 'number')
  if (rm.length >= 3) {
    const sums = [[0,0],[0,0],[0,0],[0,0]]; rm.forEach(m => { const b = 3 - Math.min(3, _weekIdx(m.date)); sums[b][0] += m.value; sums[b][1] += 1 })
    const avgs = sums.map(([s, n]) => n ? s / n : null); const present = avgs.filter(a => a != null)
    if (present.length >= 2) {
      const dipping = present[present.length - 1] < present[0]
      out.push({ id: 'insight_mood', type: 'insight', icon: 'mood', takeaway: dipping ? 'Your mood has trended lower recently' : 'Your mood has held steady lately', basis: 'Based on your daily check-ins', spark: avgs.map(a => a == null ? 0 : a), score: 55 + (dipping ? 20 : 0) })
    }
  }
  // Ready to share — upcoming visit + interval data (drills into the real visit export)
  if (upcomingAppt) {
    const start = localDateStr(new Date(Date.now() - 30 * 86400000))
    const n = symptoms.filter(s => s.date >= start).length + doseLogs.filter(d => d.date >= start).length
    if (n > 0) { const days = _daysBetweenStr(today, upcomingAppt.date); out.push({ id: 'share', type: 'ready-to-share', icon: 'ios_share', takeaway: `Your check-ins are ready to share for your ${fmtShort(upcomingAppt.date)} visit`, basis: 'Tap to review and send to your care team', score: 85 + (days <= 3 ? 15 : 0) }) }
  }
  // Option teaser removed — the guideline-mapped next step lives in the summary narrative now.
  // Arrival — a next step resolved recently via signal (novelty)
  pending.filter(p => p.state === 'resolved' && p.resolvedDate && _daysBetweenStr(p.resolvedDate, today) <= 2 && (p.kind === 'records' || p.kind === 'genomic')).forEach(p => {
    out.push({ id: 'arrival_' + p.id, type: 'arrival', icon: (NEXT_STEP_KINDS[p.kind] || {}).icon || 'check_circle', takeaway: p.kind === 'genomic' ? 'Your genomic results are in' : 'Your records finished syncing', basis: 'Tap to view', score: 110 })
  })
  return out.sort((a, b) => b.score - a.score).slice(0, 2)
}
// Prose summary — the AI's plain-language read of the pathway: where you are → the
// guideline-mapped next step (NCCN-style, via the recommendation engine) → how to prepare.
// Deterministic template over real record fields; keeps clinical claims to what the engine
// produces and follows the plain-language standard (no procedure names in the summary).
const _EXTENT_PHRASE = { one_place: " that's in one place", nodes: ' that has spread to nearby lymph nodes', spread: ' that has spread to other parts of the body', early: " that's been described as early" }
// Summary sentences are patient-copy templates (services/patientCopy.js): facts about the
// patient use {they}/{their}; things the reader manages stay "your".
const buildWelcomeSummaryText = (ps, recs) => {
  const ans = ps.onboardingAnswers || {}
  const t = (tpl) => fillCopy(tpl, careSubject(ps))
  const cancer = CANCER_TYPES.find(c => c.code === ps.diagnosisCode)
  const dx = (cancer ? cancer.name.toLowerCase() : 'cancer') + (_EXTENT_PHRASE[ans.extent] || '')
  const situation = {
    just_diagnosed: `{They} {were|was} recently diagnosed with ${dx}, and treatment hasn't started yet.`,
    in_treatment:   `{They're} in treatment for ${dx}.`,
    finished:       `{They've} finished treatment for ${dx}.`,
  }[ans.treatment_phase] || `{They're} dealing with ${dx}.`
  const gaps = deriveQuestionGaps(ans).map(g => g.kind)
  let plan
  if (recs && recs.length) {
    plan = 'Your care plan lays out the treatment options guidelines describe for this — a starting point for talking with your care team.'
    if (gaps.includes('q-drivers')) plan += " Telling us what's driving {their} cancer could open up more."
  } else if (gaps.includes('q-type')) {
    plan = '{Their} diagnosis is on {your|the} care plan; adding the exact type will let it lay out the options guidelines describe.'
  } else if (gaps.includes('q-stage')) {
    plan = '{Their} diagnosis is on {your|the} care plan; adding {your|the} stage will let it lay out the options guidelines describe.'
  } else {
    plan = '{Their} diagnosis is on {your|the} care plan, and your next steps are below.'
  }
  return t(`Welcome — here's where things stand. ${situation} ${plan} Checking in below keeps this up to date, day to day.`)
}
const buildSummaryNarrative = (ps, timeline = [], recs = null) => {
  const todayStr = localDateStr()
  // First run: the day's summary, built from what they just told us. Same card and voice
  // as every later day — it demonstrates what the summary does (pulls the situation together
  // and points to what's next) rather than describing it. A light welcome opens it; the
  // closing line hints that it stays current. Normal summary from day two.
  if (ps && ps.onboardedDate && ps.onboardedDate === todayStr) {
    return { text: buildWelcomeSummaryText(ps, recs), enrich: false }
  }
  const monthName = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' }) } catch { return null } }
  const events = (timeline || []).flatMap(day => (day.events || []).map(e => ({ ...e, _date: day.date, _isToday: !!day.isToday })))
  const nonDx = events.filter(e => e.type !== 'diagnosis')
  const surg = nonDx.find(e => /nephrectomy|prostatectomy|mastectomy|lumpectomy|resection|ablation|surgery/i.test(e.name || ''))
  const path = nonDx.find(e => /patholog/i.test(e.name || ''))
  const dx = events.find(e => e.type === 'diagnosis')
  const todayAppt = nonDx.find(e => e._isToday && e.type === 'appointment')
  const nextAppt = nonDx.filter(e => e.type === 'appointment' && !e._isToday && e._date > todayStr).sort((a, b) => a._date.localeCompare(b._date))[0] || null
  const hasRecs = !!(recs && recs.length)
  const s = []

  const t = (tpl) => fillCopy(tpl, careSubject(ps))   // patient-copy templates
  if (todayAppt) { const dr = shortDrName(todayAppt.provider || todayAppt.name); s.push(t(dr ? `Today {they} {have|has} an appointment with ${dr}.` : '{They} {have|has} an appointment today.')) }
  if (surg) {
    const wks = Math.round(_daysBetweenStr(surg._date, todayStr) / 7)
    const when = (wks >= 1 && wks <= 10) ? `about ${wks} week${wks > 1 ? 's' : ''} out from surgery` : `past surgery${monthName(surg._date) ? ` from ${monthName(surg._date)}` : ''}`
    s.push(t(`{They're} ${when.replace('from surgery', 'from {your |}surgery').replace('past surgery', 'past {your |}surgery')}${path ? ', and {your|the} results have been reviewed' : ''}.`))
  } else if (dx && !hasRecs && !nextAppt) {
    s.push(t(`You've shared {their} diagnosis, and we're building {your|the} care picture.`))
  }
  if (hasRecs) {
    if (nextAppt) s.push(t(`Based on everything in {their} record, the guidelines map out your next steps — the focus of {your|the} appointment ${relativeApptDate(nextAppt._date)}. You can review them under Suggested treatments below.`))
    else s.push(t(`Based on everything in {their} record, the guidelines map out your next steps to weigh — see Suggested treatments below.`))
  } else if (nextAppt) {
    s.push(t(`Your next step is {their} appointment ${relativeApptDate(nextAppt._date)}.`))
  }
  if (hasRecs || nextAppt) s.push(t(`Logging how {they're} feeling and noting your questions now will help {you understand and|you both} prepare for it.`))

  if (s.length === 0) return { text: `We're still building your picture. The more you add — a daily check-in, your events and their details, or connecting your records — the clearer this summary and your next steps become.`, enrich: true }
  return { text: s.join(' '), enrich: false }
}
const TeaserDetailSheet = ({ teaser, onClose }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const close = (cb) => { setVis(false); setTimeout(() => cb && cb(), 300) }
  const spark = teaser.spark || []
  const max = Math.max(...spark, 1)
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 420 }}>
      <div onClick={() => close(onClose)} style={{ position: 'absolute', inset: 0, backgroundColor: vis ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: 'background-color 0.3s ease' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bgCard, borderRadius: '22px 22px 0 0', boxShadow: '0 -6px 28px rgba(0,0,0,0.16)', padding: '10px 20px 34px', transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.34s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '0 auto 18px' }}/>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 6 }}>{teaser.takeaway}</div>
        {teaser.basis && <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>{teaser.basis}</div>}
        {spark.length > 1 && (
          <div style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '16px 16px 12px', marginBottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, height: 120 }}>
            {spark.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: 34, height: `${Math.max(6, (v / max) * 78)}px`, backgroundColor: i === spark.length - 1 ? C.textSecondary : C.border, borderRadius: 6 }}/>
                <span style={{ fontSize: 10, color: C.textTertiary }}>{['3 wk', '2 wk', '1 wk', 'Now'][i] || ''}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, color: C.textTertiary, lineHeight: 1.5 }}>The full trends & insights view is a later pass — this previews the detail you'll drill into from the summary.</div>
      </div>
    </div>,
    document.body
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REDESIGN-04 "Today" — Home becomes its own edited daily surface (not the top
// of the timeline scroll). A finite, curated stack of zones; the timeline and
// treatment options become destinations reached from here. Reuses the check-in,
// prose summary, and next-steps built in 02/03. Content & Opportunities are
// honest first-slice placeholders. Rule: a zone shows only when it has something.
// ═══════════════════════════════════════════════════════════════════════════
const _greetPart = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }
// Time-of-day: salutation + a subtle mark (sunrise / sun / moon) with a soft per-time tint.
const _TOD = {
  // rise: how far the glyph sits above the Daily summary card, which acts as the horizon.
  // Morning = the same sun, low and half-hidden behind the card (rising); afternoon = fully up.
  // (No wb_twilight — its built-in horizon line read as a hamburger stacked on the card.)
  morning:   { part: 'Good morning',   icon: 'wb_sunny', tint: '#fbeecd', color: '#c8802f', rise: 84 },
  afternoon: { part: 'Good afternoon', icon: 'wb_sunny', tint: '#fdf1d6', color: '#d39a34', rise: 128 },
  evening:   { part: 'Good evening',   icon: 'bedtime',  tint: '#e8eafb', color: '#5f68b8', rise: 128 },
}
// override: 'morning' | 'afternoon' | 'evening' | null/'auto' (dev toggle in profile)
const _todInfo = (override) => {
  if (override && _TOD[override]) return _TOD[override]
  const h = new Date().getHours()
  return h < 12 ? _TOD.morning : h < 18 ? _TOD.afternoon : _TOD.evening
}
const TodayZone = ({ label, children }) => (
  <div style={{ marginBottom: 28 }}>
    {label && <div style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, letterSpacing: '0.01em', padding: '0 4px 11px' }}>{label}</div>}
    {children}
  </div>
)
// ─── REDESIGN-04: card-less check-in (nodes on a spine) ─────────────────────
const CheckInSpine = ({ state, justChecked, moodLabel, count = 0, onMood, onMoodSelect, onSymptomsYes, onSymptomsNo, onSymptomsEdit, symptomEntry, onJournal, onJournalEdit, journalEntry }) => {
  const t = usePatientCopy()
  const [openKey, setOpenKey] = useState(() => !state.mood ? 'mood' : !state.symptoms ? 'symptoms' : !state.journal ? 'journal' : null)
  const nodes = [
    { key: 'mood', label: 'Mood', done: !!state.mood, promptSub: t('How {are|is} {they} feeling today?'), doneSub: moodLabel ? `Feeling ${moodLabel.toLowerCase()}` : 'Logged today' },
    { key: 'symptoms', label: 'Symptoms', done: !!state.symptoms, promptSub: t('Any symptoms {|for {they} }today?'), doneSub: state.symptoms === 'none' ? 'None today' : (symptomEntry ? symptomEntry.name + (symptomEntry.severity ? ' · ' + symptomEntry.severity : '') : 'Logged today') },
    { key: 'journal', label: 'Journal', done: !!state.journal, promptSub: t(journalPrompt()), doneSub: journalEntry ? (journalEntry.text.length > 42 ? journalEntry.text.slice(0, 42).trim() + '…' : journalEntry.text) : 'Added today' },
  ]
  const moodFace = (MOOD_SCALE.find(m => m.label === moodLabel) || {}).face || 'sentiment_satisfied'
  const advanceFrom = (key) => setOpenKey((nodes.find(x => x.key !== key && !x.done) || {}).key || null)
  const doneRef = useRef({ mood: false, symptoms: false, journal: false })
  useEffect(() => {
    const cur = { mood: !!state.mood, symptoms: !!state.symptoms, journal: !!state.journal }
    const prev = doneRef.current
    const justDone = ['mood', 'symptoms', 'journal'].find(k => cur[k] && !prev[k])
    if (justDone && (openKey === justDone || openKey == null)) setOpenKey((nodes.find(x => !x.done) || {}).key || null)
    doneRef.current = cur
  }, [state.mood, state.symptoms, state.journal])
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 2px 3px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary }}>Today's check-in</div>
        {count > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 14, color: C.textTertiary, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>event_available</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.textTertiary }}>{count} check-in{count > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: C.textTertiary, lineHeight: 1.45, padding: '0 2px 16px' }}>{t("A minute a day builds {their} daily log, revealing patterns you'd otherwise miss.")}</div>
      <div>
        {nodes.map((n, i) => {
          const last = i === nodes.length - 1
          const open = openKey === n.key
          const collapsedDone = n.done && !open
          return (
            <div key={n.key} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 26, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ paddingTop: 14 }}><CheckIcon done={n.done} pop={justChecked === n.key}/></div>
                {!last && <div style={{ flex: 1, width: 2, backgroundColor: C.timelineLine, marginTop: 6, marginBottom: -12 }}/>}
              </div>
              <div style={{ flex: 1, minWidth: 0, marginBottom: last ? 0 : 12 }}>
                <div style={{ backgroundColor: open ? '#ffffff' : '#fdf1ea', borderRadius: 16, padding: '13px 15px', border: `1px solid ${open ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.05)'}`, boxShadow: open ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', transition: 'background-color 0.16s ease' }}>
                  <div onClick={() => { setOpenKey(open ? null : n.key) }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{n.label}</div>
                      <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {collapsedDone && n.key === 'mood' && <span className="material-symbols-rounded" style={{ fontSize: 17, color: C.textSecondary, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>{moodFace}</span>}
                        <span>{collapsedDone ? n.doneSub : n.promptSub}</span>
                      </div>
                    </div>
                    <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.16s ease' }}>expand_more</span>
                  </div>

                  {open && n.key === 'mood' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                      {MOOD_SCALE.map(m => { const sel = moodLabel && m.label === moodLabel; return (
                        <button key={m.v} onClick={() => { onMoodSelect && onMoodSelect(m.v); advanceFrom('mood') }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'Inter,sans-serif' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: 30, color: sel ? C.primary : C.textIcon, fontVariationSettings: sel ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 300" }}>{m.face}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: sel ? C.primary : C.textTertiary }}>{m.label}</span>
                        </button>
                      )})}
                    </div>
                  )}

                  {open && n.key === 'symptoms' && (
                    state.symptoms === 'logged' && symptomEntry ? (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{symptomEntry.name}{symptomEntry.severity ? ` · ${symptomEntry.severity}` : ''}</div>
                        {symptomEntry.notes ? <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginTop: 3 }}>{symptomEntry.notes}</div> : null}
                        <button onClick={() => onSymptomsEdit && onSymptomsEdit()} style={{ ..._qLink, marginTop: 10 }}>Edit symptoms</button>
                      </div>
                    ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                      <button onClick={() => { onSymptomsNo && onSymptomsNo(); advanceFrom('symptoms') }} style={_qLink}>None today</button>
                      <button onClick={() => { onSymptomsYes && onSymptomsYes() }} style={_ciPrimary}>Log symptoms</button>
                    </div>
                    )
                  )}

                  {open && n.key === 'journal' && (
                    <div style={{ marginTop: 12 }}>
                      {n.done && journalEntry && <div style={{ fontSize: 13.5, color: C.textPrimary, lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 11 }}>{journalEntry.text}</div>}
                      <button onClick={() => { (n.done ? onJournalEdit : onJournal) && (n.done ? onJournalEdit() : onJournal()) }} style={n.done ? _qLink : _ciPrimary}>{n.done ? 'Edit note' : 'Write a note'}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─── REDESIGN-04: recency-led Today bands ("new and relevant to me") ─────────
// Today = recency. Evergreen content lives in Resources; care-plan-contextual content
// (incl. sponsored campaigns) belongs in Care Plan. seeAll routes: news/webinars →
// resources, community → community.
// Caregiver content — relationship is the content signal. A SAMPLE, not a takeover: one
// item in the webinars band and one in the community band swap for a caregiver-relevant
// one (2 of 6 cards); the news band (incl. the sponsored slot) is unchanged.
const CAREGIVER_CONTENT = {
  parent:  { webinar: 'Caring for a parent with cancer',                       post: { initials: 'RM', title: "How do you keep track of a parent's appointments and meds?", body: "My dad was just diagnosed and I'm the one driving him to everything. How do you keep track of meds, questions, and who said what?", replies: 7 } },
  spouse:  { webinar: 'When your partner has cancer: caring for them and you',  post: { initials: 'TK', title: 'Spouses and partners — how did you get through the first weeks?', body: "My husband starts treatment next week. I'm trying to hold everything together — what helped you in those first weeks?", replies: 9 } },
  child:   { webinar: 'When your child has cancer: where to start',             post: { initials: 'AL', title: 'Parents of kids in treatment — how do you explain it?', body: "Our son is 9. How have you explained treatment and side effects at a level a kid can handle?", replies: 5 } },
  sibling: { webinar: 'Supporting a sibling through treatment',                 post: { initials: 'JB', title: 'Supporting my sister from three states away', body: "I can't be there day to day. How do you stay useful to a sibling going through treatment from a distance?", replies: 3 } },
  friend:  { webinar: 'How to show up for a friend with cancer',                post: { initials: 'NS', title: 'What actually helped when a friend was in treatment?', body: "I want to help my best friend without overstepping. What did people do for you that genuinely helped?", replies: 6 } },
  other:   { webinar: 'Caregiving 101: supporting someone through treatment',   post: { initials: 'DW', title: "New caregiver here — what do you wish you'd known?", body: "I'm suddenly helping someone through cancer treatment and don't know where to start. What do you wish someone had told you?", replies: 8 } },
}
const todayBands = (cancer, relationship = null) => {
  const bands = _baseTodayBands(cancer)
  const cg = relationship && (CAREGIVER_CONTENT[relationship] || CAREGIVER_CONTENT.other)
  if (!cg) return bands
  return bands.map(b =>
    b.id === 'webinars'  ? { ...b, items: [{ kind: 'For caregivers', icon: 'diversity_1', tint: '#fdeee8', title: cg.webinar, sub: 'Watch the replay' }, b.items[0]] } :
    b.id === 'community' ? { ...b, items: [{ format: 'text', author: 'Caregiver', time: '3 days ago', ...cg.post }, b.items[0]] } :
    b)
}
const _baseTodayBands = (cancer) => [
  { id: 'news', title: cancer && cancer !== 'your cancer' ? `New in ${cancer}` : 'New for you', seeAll: 'resources', items: [
    { kind: 'News', image: IMG_FDA_LAB, icon: 'newspaper', tint: '#eef2fb', title: 'FDA expands approval for a kidney cancer combination', sub: 'Reuters Health · 2d ago' },
    { kind: 'Sponsored', sponsored: true, image: IMG_SPONSORED_THERAPY, icon: 'medication', tint: '#eef7f1', title: 'Understanding a newer targeted therapy', sub: 'From a treatment partner' },
  ]},
  { id: 'webinars', title: 'Expert webinars', seeAll: 'resources', items: [
    { kind: 'Webinar', image: IMG_WEBINAR_FUH, icon: 'smart_display', tint: '#f3eefb', title: 'Ask the Expert with Dr. Fuh', sub: 'Watch the replay' },
    { kind: 'Webinar', image: IMG_WEBINAR_LENZ, icon: 'smart_display', tint: '#fdf3ea', title: 'Ask the Expert with Dr. Lenz', sub: 'Watch the replay' },
  ]},
  { id: 'community', title: 'From the community', seeAll: 'community', items: [
    { format: 'text', initials: 'HF', author: 'Community Member', time: '10 days ago', title: 'How can I manage severe treatment flushing and sleep problems?', body: 'Eight years in treatment for sarcomatoid metastatic RCC. My naturopath has neutralized most side effects except flushing — it\u2019s become severe and is interrupting my sleep. Has anyone found something that helps?', replies: 1 },
    { format: 'text', initials: 'JS', author: 'Community Member', time: '19 days ago', title: 'Has anyone had Keytruda for kidney cancer?', body: 'Diagnosed with RCC and had a full nephrectomy; scans are clear. I\u2019m scheduled to start Keytruda soon — is anyone on this treatment, and how bad are the side effects?', replies: 4 },
  ]},
]
// 2-up band. Two card formats: media (image/kind/title/sub) and text (community:
// initials avatar + author·time, title only, comment count).
const ContentBand = ({ title, items = [], onSeeAll }) => {
  if (!items || items.length < 2) return null
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 13px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary }}>{title}</div>
        <button onClick={onSeeAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary, fontFamily: 'Inter,sans-serif' }}>See all</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
        {items.slice(0, 2).map((it, i) => (
          <button key={i} onClick={onSeeAll} style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', backgroundColor: C.bgCard, ...SOFT_CARD, padding: 0, overflow: 'hidden', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            {it.format === 'text' ? (
              <div style={{ padding: '13px 14px 14px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 152 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, color: C.textIcon, flexShrink: 0 }}>{it.initials}</div>
                  <div style={{ fontSize: 11, color: C.textTertiary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.author} · {it.time}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>{it.title}</div>
                <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 14, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>forum</span>
                  {it.replies} {it.replies === 1 ? 'comment' : 'comments'}
                </div>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', height: 84, background: it.image ? '#eee' : `linear-gradient(135deg, ${it.tint} 0%, #ffffff 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {it.image
                    ? <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : <span className="material-symbols-rounded" style={{ fontSize: 27, color: C.textSecondary, opacity: 0.85, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>{it.icon}</span>}
                  {it.sponsored && <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 700, color: C.textTertiary, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 5, padding: '2px 6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Sponsored</span>}
                </div>
                <div style={{ padding: '11px 13px 14px' }}>
                  {it.kind && <div style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, opacity: 0.9 }}>{it.kind}</div>}
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.35 }}>{it.title}</div>
                  <div style={{ fontSize: 11.5, color: C.textTertiary, marginTop: 3 }}>{it.sub}</div>
                </div>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Ask O4M — the clinical-team form ─────────────────────────────
// A one-off question to Outcomes4Me's oncology clinical team (people, not AI). Distinct from
// the patient's own care team, so the form says so — and points urgent issues elsewhere.
// Prototype stand-in: production launches the real clinical-team form; fields here are a
// strawman (optional topic + question).
const ASK_TOPICS = ['Treatment options', 'Side effects', 'Test results', 'Clinical trials', 'Something else']
const AskO4MSheet = ({ onClose, onSend, initialQuestion = '', fullView = false }) => {  // fullView: opened from chat, slides up as a full view
  const t = usePatientCopy()
  const [vis, setVis] = useState(false)
  const [topic, setTopic] = useState(null)
  const [q, setQ] = useState(initialQuestion)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const close = (cb) => { setVis(false); setTimeout(() => cb && cb(), 300) }
  const ok = !!q.trim()
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 420 }}>
      <div onClick={() => close(onClose)} style={{ position: 'absolute', inset: 0, backgroundColor: vis ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: 'background-color 0.3s ease' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: fullView ? 0 : 'auto', maxHeight: fullView ? 'none' : '92%', overflowY: 'auto', backgroundColor: C.bgCard, borderRadius: fullView ? 0 : '22px 22px 0 0', boxShadow: fullView ? 'none' : '0 -6px 28px rgba(0,0,0,0.16)', padding: fullView ? 'calc(8px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))' : '10px 20px calc(24px + env(safe-area-inset-bottom, 0px))', transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.34s cubic-bezier(0.32,0.72,0,1)', fontFamily: 'Inter,sans-serif' }}>
        {fullView
          ? <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 -8px 8px' }}><button onClick={() => close(onClose)} aria-label="Close" style={{ width: 44, height: 44, border: 'none', background: '#fff', borderRadius: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="material-symbols-rounded" style={{ fontSize: 24, color: '#414652' }}>close</span></button></div>
          : <div style={{ width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '0 auto 16px' }}/>}
        <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 6 }}>Ask O4M</div>
        <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20, lineHeight: 1.55 }}>Send a question to our oncology clinical team. A person reads every question and follows up, usually within a day.</div>

        <div style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 9 }}>What's it about? <span style={{ fontWeight: 400, color: C.textTertiary }}>Optional</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
          {ASK_TOPICS.map(tp => {
            const on = topic === tp
            return <button key={tp} onClick={() => setTopic(on ? null : tp)} style={{ height: 36, padding: '0 14px', borderRadius: 9999, border: `${on ? 1.5 : 1}px solid ${on ? C.primary : C.border}`, backgroundColor: on ? C.primaryLight : C.bgCard, color: on ? C.primary : C.textPrimary, fontSize: 13.5, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{tp}</button>
          })}
        </div>

        <NotesTextarea value={q} onChange={setQ} placeholder={t('What would you like to ask{| about {their} care}?')}/>

        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', backgroundColor: C.bgApp, borderRadius: 12, padding: '11px 13px', margin: '4px 0 16px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, marginTop: 1 }}>info</span>
          <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5 }}>{t("This goes to Outcomes4Me's clinical team, not {your|the} doctor's office. For anything urgent, call {your|the} care team or 911.")}</div>
        </div>

        <button onClick={() => ok && close(() => onSend({ topic, question: q.trim() }))} style={{ width: '100%', height: 52, borderRadius: 9999, backgroundColor: ok ? C.primary : C.bgApp, border: 'none', cursor: ok ? 'pointer' : 'default', fontSize: 16, fontWeight: 700, color: ok ? '#fff' : C.textTertiary, fontFamily: 'Inter,sans-serif' }}>Send to the clinical team</button>
      </div>
    </div>,
    document.body
  )
}
// ─── REDESIGN-04: "Share your full picture" — on-demand care summary snapshot ──
// Assembled live from what the patient has logged (symptoms/meds/journal/mood/
// timeline/patientState). NOT a persisted daily object — distinct from the Daily
// summary and from Your care plan. Transparent header; glass control chips float
// over the content, which scrolls underneath.
const CANCER_LABELS = { RCC: 'kidney cancer', BREAST: 'breast cancer', CRC: 'colorectal cancer', LUNG: 'lung cancer', PROS: 'prostate cancer', BLAD: 'bladder cancer', OV: 'ovarian cancer' }
const _shortDate = (iso) => { try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return iso } }
const GLASS_CHIP = { pointerEvents: 'auto', width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)', cursor: 'pointer' }  // v3.19: header buttons are white floating
const SummarySectionLabel = ({ children }) => <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.textTertiary, margin: '22px 0 10px' }}>{children}</div>
const SummaryCard = ({ children }) => <div style={{ backgroundColor: C.bgCard, ...SOFT_CARD, borderRadius: 14, padding: '14px 16px' }}>{children}</div>
const SummaryEmpty = ({ children }) => <SummaryCard><div style={{ fontSize: 13.5, color: C.textTertiary }}>{children}</div></SummaryCard>
// Sharing goes to a care team, so it needs the patient's real name. A caregiver's warm name
// ("Mom") stays on screen; the first share asks once for the full name and keeps it on the
// record (patientState.patientFullName). Self uses the account name.
const CareSummarySheet = ({ symptoms = [], medications = [], journal = [], mood = [], timeline = [], patientState = {}, accountName = '', onSavePatientDetails, onClose }) => {
  const t = usePatientCopy()
  const sub = t.sub
  const [askName, setAskName] = useState(false)
  const [fullName, setFullName] = useState(patientState.patientFullName || '')
  const [dob, setDob] = useState(patientState.dateOfBirth || '')
  // What the care team needs that the record doesn't have yet (caregivers only — self always has both).
  const needName = !sub.self && !patientState.patientFullName
  const needDob = !sub.self && !patientState.dateOfBirth
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const close = () => { setVis(false); setTimeout(onClose, 300) }
  const cancer = CANCER_LABELS[patientState.diagnosisCode] || 'your cancer'
  const recentSymptoms = symptoms.slice(-6).reverse()
  const recentJournal = journal.slice(-3).reverse()
  const latestMood = mood.slice(-1)[0]
  const recentEvents = timeline.map(d => d.event).filter(Boolean).slice(-4).reverse()
  const doShare = (legalName, birthDate = patientState.dateOfBirth) => {
    const who = [legalName, birthDate ? `DOB ${birthDate}` : null].filter(Boolean).join(', ')
    const text = `Care summary${who ? ` for ${who}` : ''} — ${cancer}. ${recentSymptoms.length} recent symptoms, ${medications.length} current medications, ${journal.length} journal entries.`
    if (navigator.share) navigator.share({ title: t('{My|{Their}} full picture'), text }).catch(() => {})
    else { try { navigator.clipboard.writeText(text) } catch {} }
  }
  const share = () => {
    if (sub.self) { doShare(accountName); return }
    if (!needName && !needDob) { doShare(patientState.patientFullName); return }
    setAskName(true)
  }
  // Name is required to share; the date of birth is asked again only if it's still unknown,
  // and they can share without it.
  const confirmName = () => {
    const n = (needName ? fullName : patientState.patientFullName || '').trim(); if (!n) return
    const details = {}
    if (needName) details.patientFullName = n
    if (needDob && dob) details.dateOfBirth = dob
    if (Object.keys(details).length) onSavePatientDetails && onSavePatientDetails(details)
    setAskName(false); doShare(n, dob || patientState.dateOfBirth)
  }
  const askTitle = needName && needDob ? t('Add {their} full name and date of birth') : needName ? t('Add {their} full name') : t('Add {their} date of birth')
  const rowDivider = (i) => ({ padding: i ? '10px 0 0' : 0, borderTop: i ? `1px solid ${C.border}` : 'none', marginTop: i ? 10 : 0 })
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'linear-gradient(180deg, #fbf6f4 0%, #fdfbfb 26%, #ffffff 100%)', transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.34s cubic-bezier(0.32,0.72,0,1)', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',sans-serif" }}>
      {/* Transparent header — floating glass chips */}
      <div style={{ position: 'absolute', top: 'calc(8px + env(safe-area-inset-top, 0px))', left: 0, right: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, padding: '0 14px', pointerEvents: 'none' }}>
        <button onClick={share} aria-label="Share" style={GLASS_CHIP}><span className="material-symbols-rounded" style={{ fontSize: 20, color: C.primary }}>ios_share</span></button>
        <button onClick={close} aria-label="Close" style={GLASS_CHIP}><span className="material-symbols-rounded" style={{ fontSize: 22, color: C.textIcon }}>close</span></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 'calc(20px + env(safe-area-inset-top, 0px)) 18px 28px' }}>
        <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.5px', color: C.textPrimary, marginBottom: 7, maxWidth: 'calc(100% - 92px)' }}>{t('{Their} full picture')}</div>
        <div style={{ fontSize: 14.5, color: C.textSecondary, lineHeight: 1.6 }}>Everything you've logged — symptoms, medications, journal, and treatment — pulled together as of today, ready to share with your care team.</div>

        <SummarySectionLabel>Overview</SummarySectionLabel>
        <SummaryCard>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 6, textTransform: 'capitalize' }}>{cancer}{patientState.stage ? ` · Stage ${patientState.stage}` : ''}</div>
          {(patientState.dateOfBirth || (patientState.ageRange && patientState.ageRange !== 'unsure')) && (
            <div style={{ fontSize: 12.5, color: C.textTertiary, marginBottom: 6 }}>
              {patientState.dateOfBirth ? `Born ${new Date(patientState.dateOfBirth + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : `Age ${ageRangeLabel(patientState.ageRange).toLowerCase()} · exact date not added`}
            </div>
          )}
          <div style={{ fontSize: 13.5, color: C.textSecondary, lineHeight: 1.6 }}>
            Recently you've logged {symptoms.length} symptom {symptoms.length === 1 ? 'entry' : 'entries'} and {journal.length} journal {journal.length === 1 ? 'entry' : 'entries'}, and you're tracking {medications.length} {medications.length === 1 ? 'medication' : 'medications'}.{latestMood ? ` Your latest mood was ${(latestMood.label || '').toLowerCase()}.` : ''}
          </div>
        </SummaryCard>

        <SummarySectionLabel>Recent symptoms</SummarySectionLabel>
        {recentSymptoms.length ? recentSymptoms.map((sx, i) => (
          <div key={sx.id || i} style={{ marginBottom: 8 }}>
            <SummaryCard>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: C.textPrimary }}>{sx.name}{sx.severity ? <span style={{ fontWeight: 500, color: C.textSecondary }}> · {sx.severity}</span> : null}</div>
                <div style={{ fontSize: 12, color: C.textTertiary }}>{_shortDate(sx.date)}</div>
              </div>
              {sx.notes ? <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginTop: 4 }}>{sx.notes}</div> : null}
            </SummaryCard>
          </div>
        )) : <SummaryEmpty>No symptoms logged yet.</SummaryEmpty>}

        <SummarySectionLabel>Current medications</SummarySectionLabel>
        {medications.length ? (
          <SummaryCard>
            {medications.map((m, i) => (
              <div key={m.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, ...rowDivider(i) }}>
                <span className="material-symbols-rounded" style={{ fontSize: 19, color: C.primary }}>medication</span>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.textPrimary }}>{m.name}</div>
              </div>
            ))}
          </SummaryCard>
        ) : <SummaryEmpty>No medications tracked yet.</SummaryEmpty>}

        <SummarySectionLabel>Recent journal</SummarySectionLabel>
        {recentJournal.length ? recentJournal.map((j, i) => (
          <div key={j.id || i} style={{ marginBottom: 8 }}>
            <SummaryCard>
              <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 4 }}>{_shortDate(j.date)}</div>
              <div style={{ fontSize: 13.5, color: C.textPrimary, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{j.text}</div>
            </SummaryCard>
          </div>
        )) : <SummaryEmpty>No journal entries yet.</SummaryEmpty>}

        <SummarySectionLabel>What's changed lately</SummarySectionLabel>
        {recentEvents.length ? (
          <SummaryCard>
            {recentEvents.map((ev, i) => (
              <div key={ev.id || i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, ...rowDivider(i) }}>
                <div style={{ flex: 1, fontSize: 14, color: C.textPrimary }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: C.textTertiary }}>{_shortDate(ev.date)}</div>
              </div>
            ))}
          </SummaryCard>
        ) : <SummaryEmpty>Nothing notable recently.</SummaryEmpty>}

        <div style={{ fontSize: 11.5, color: C.textTertiary, lineHeight: 1.5, margin: '20px 2px 0' }}>Assembled from what you've logged in Outcomes4Me. Share or print to bring to your care team.</div>
      </div>
      <div style={{ padding: '10px 18px calc(16px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>
        <button onClick={share} style={{ width: '100%', height: 52, borderRadius: 14, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>ios_share</span>Share with your care team
        </button>
      </div>
      {askName && (
        <div onClick={() => setAskName(false)} style={{ position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', backgroundColor: C.bgCard, borderRadius: '20px 20px 0 0', padding: '22px 20px calc(18px + env(safe-area-inset-bottom, 0px))' }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 6 }}>{askTitle}</div>
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.55, marginBottom: 18 }}>The care team uses {needName && needDob ? 'both' : 'it'} to match this summary to the right person. We'll keep {needName && needDob ? 'them' : 'it'} for next time.</div>
            {needName && <AuthField label="Full name" value={fullName} onChange={setFullName} type="text" placeholder="First and last name" required/>}
            {needDob && <DateInputField label="Date of birth" value={dob} onChange={setDob} max={localDateStr()} yearRange={[new Date().getFullYear() - 110, new Date().getFullYear()]} defaultValue={`${new Date().getFullYear() - 65}-01-01`} hint={needName ? "Don't know it yet? You can share without it." : null}/>}
            {(() => { const ok = !needName || fullName.trim(); return (
              <button onClick={confirmName} style={{ width: '100%', height: 52, borderRadius: 14, backgroundColor: C.primary, border: 'none', cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.45, fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'Inter,sans-serif' }}>{needDob && !dob && !needName ? 'Share without it' : 'Save and share'}</button>
            ) })()}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
// ─── REDESIGN-04: two side-by-side CTAs off the summary (options + ask a human) ──
// The pair off the summary: self-serve (your care plan) + ask a person (O4M's clinical team).
const TodayCTAs = ({ onViewPlan, onAskClinical }) => {
  const ctas = [
    { key: 'plan', icon: 'route', label: 'Your care plan', sub: 'Treatment options and history', onClick: onViewPlan },
    { key: 'ask',  icon: 'forum', label: 'Ask O4M',        sub: 'Questions to our clinical team', onClick: onAskClinical },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
      {ctas.map(c => (
        <button key={c.key} onClick={c.onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', backgroundColor: C.bgCard, ...SOFT_CARD, padding: '16px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
          <div style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 11 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 21, color: C.textIcon, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{c.icon}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', fontSize: 14.5, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.2px' }}>
            {c.label}
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, marginLeft: 'auto' }}>chevron_right</span>
          </div>
          <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>{c.sub}</div>
        </button>
      ))}
    </div>
  )
}

const TreatmentOptionsCard = ({ onView }) => (
  <button onClick={onView} style={{ display: 'block', width: '100%', textAlign: 'left', backgroundColor: C.bgCard, ...SOFT_CARD, padding: '18px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 11 }}>Based on NCCN guidelines</div>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 21, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>clinical_notes</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16.5, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: 3 }}>Your treatment options</div>
        <div style={{ fontSize: 13.5, color: C.textSecondary, lineHeight: 1.5 }}>The guidelines map your next steps from everything in your record — review them and prepare to discuss.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>Review options</span>
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.primary }}>chevron_right</span>
        </div>
      </div>
    </div>
  </button>
)
const TodayScreen = ({ userName, summary, narrative, teasers, onTeaserAction, onAddEvent, checkin, checkinJustChecked, checkinMoodLabel, checkinCount, onCheckinMood, onCheckinMoodSelect, onCheckinSymptomsYes, onCheckinSymptomsNo, onCheckinSymptomsEdit, checkinSymptomEntry, onCheckinJournal, onCheckinJournalSave, onCheckinJournalEdit, checkinJournalEntry, todos = [], onTodoAction, onViewTimeline, onViewTreatments, hasTreatments = false, onAsk, onOpenCommunity, onViewCareSummary, cancerLabel = 'your cancer', onViewResources, todOverride = null, onAskClinical }) => {
  const t = usePatientCopy()
  const subject = t.sub
  const first = (userName || '').trim().split(' ')[0] // may be empty — onboarding doesn't ask a name
  const today = new Date()
  const dateLine = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const doorway = (icon, title, sub, onClick) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', backgroundColor: C.bgCard, ...SOFT_CARD, padding: '15px 18px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: C.textPrimary }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: C.textTertiary, marginTop: 1 }}>{sub}</div>}
      </div>
      <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, flexShrink: 0 }}>chevron_right</span>
    </button>
  )
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingTop: 60, paddingBottom: 96, background: 'linear-gradient(180deg, #fbf6f4 0%, #fdfbfb 30%, #ffffff 100%)' }}>
      <div style={{ padding: '32px 18px 52px', maxWidth: 640, margin: '0 auto', position: 'relative' }}>
        {/* Greeting. The time-of-day glyph is drawn with the Daily summary below so the card's
            top edge is its horizon; the greeting sits above it (zIndex 2). */}
        {(() => { const tod = _todInfo(todOverride); return (
          <>
            <div style={{ position: 'relative', zIndex: 2, marginBottom: 30, padding: '0 2px' }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.15 }}>{first ? `${tod.part}, ${first}.` : `${tod.part}.`}</div>
              <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 3 }}>{dateLine}</div>
              {/* Caregiver anchor — says whose record this is, so "you/your" across the app
                  reads as "you two". The one place the typed name appears outside onboarding/sharing. */}
              {subject && !subject.self && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13.5, fontWeight: 600, color: C.textSecondary }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16, color: C.primary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>favorite</span>
                  Caring for {subject.name}
                </div>
              )}
            </div>
          </>
        ) })()}

        {/* AI — your read (orientation; live-derived so it reflects a check-in made below) */}
        <TodayZone>
          <div style={{ position: 'relative', zIndex: 1 }}>
            {(() => { const tod = _todInfo(todOverride); return (
              // Behind the card (zIndex -1 inside this stacking context): the card is the horizon,
              // so the morning sun reads as rising from behind it.
              <div aria-hidden style={{ position: 'absolute', top: -tod.rise, right: 14, zIndex: -1, opacity: 0.3, pointerEvents: 'none', lineHeight: 1 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 172, color: tod.color, fontVariationSettings: "'FILL' 1, 'wght' 200" }}>{tod.icon}</span>
              </div>
            ) })()}
            <DailySummaryCard summary={summary} isToday={true} onAddEvent={onAddEvent} teasers={teasers} onTeaserAction={onTeaserAction} narrative={narrative} onViewRecord={onViewTimeline}/>
          </div>
        </TodayZone>

        {/* The daily habit — check-in, right under the summary it updates */}
        <TodayZone>
          <CheckInSpine state={checkin} justChecked={checkinJustChecked} moodLabel={checkinMoodLabel} count={checkinCount} onMood={onCheckinMood} onMoodSelect={onCheckinMoodSelect} onSymptomsYes={onCheckinSymptomsYes} onSymptomsNo={onCheckinSymptomsNo} onSymptomsEdit={onCheckinSymptomsEdit} symptomEntry={checkinSymptomEntry} onJournal={onCheckinJournal} onJournalEdit={onCheckinJournalEdit} journalEntry={checkinJournalEntry}/>
        </TodayZone>

        {/* Act — recommended next steps (hides itself when empty) */}
        {todos.length > 0 && <TodayZone><NextStepsSection todos={todos} onAction={onTodoAction}/></TodayZone>}

        {/* When something happens — the care plan (results, treatment change, a visit coming up)
            and asking a person. One tap away, below the daily habit (interview synthesis: the
            check-in is the daily job; the care plan is valued most but used on events). */}
        <TodayZone><TodayCTAs onViewPlan={onViewTimeline} onAskClinical={onAskClinical}/></TodayZone>

        {/* Prepare — standing entry to the on-demand care summary */}
        <TodayZone>
          <button onClick={onViewCareSummary} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', backgroundColor: C.bgCard, ...SOFT_CARD, padding: '15px 16px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 22, color: C.textIcon, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>clinical_notes</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.2px' }}>{t('Share {their} full picture')}</div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.4, marginTop: 1 }}>Symptoms, meds, journal, and treatment pulled together to share with your care team</div>
            </div>
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.primary }}>ios_share</span>
          </button>
        </TodayZone>

        {/* Content — recency-led bands, 2-up grids, each shown only when it has ≥2 items */}
        {todayBands(cancerLabel, subject && !subject.self ? (subject.relationship || 'other') : null).map(b => <ContentBand key={b.id} title={b.title} items={b.items} onSeeAll={() => b.seeAll === 'community' ? onOpenCommunity() : onViewResources()}/>)}
      </div>
    </div>
  )
}

const DaySection = ({ day, sentinelRef, isLastDay = false, highlightId, todayFlash = false, summaryShown = true, onApproachSelect, addedIds = {}, onRemoveEvent, onEditClinical, visibleRecs = [], revealedCards = null, blockGenStates = {}, genText = null, genBlockId = null, generationDone = false, onSummarize = null, onAddEvent = null, cancerSupported = true, onReviewRecs = null, showRecordsCard = false, onOpenSettings = null, onDismissRecordsCard = null, checkin = null, checkinJustChecked = null, checkinMoodLabel = null, checkinCount = 0, onCheckinMood = null, onCheckinSymptomsYes = null, onCheckinSymptomsNo = null, onCheckinJournal = null, todos = [], onTodoAction = null, dailyLog = null, summaryTeasers = [], onTeaserAction = null, treatmentBasis = [] }) => {
  const allItems = []
  // The daily summary is absent while the timeline builds; it's inserted at the top of
  // Today right after the scroll-to-Today settles.
  const showSummary = day.summary && (!day.isToday || summaryShown)
  // (redesign-04: the daily summary lives on the Today surface, not on the care-plan record.)
  // Persistent "records not synced" card sits directly below the summary on Today.
  if (day.isToday && showSummary && showRecordsCard) allItems.push({ key: 'records-card', icon: null, card: <RecordsNotSyncedCard onOpenSettings={onOpenSettings} onDismiss={onDismissRecordsCard}/> })
  // ── redesign-04: the timeline is the medical record. The daily log (mood/symptoms/
  // journal, derived from the stores) shows on every day incl today; the interactive
  // check-in / next steps live on the Today surface, not here. ──
  if (dailyLog && (dailyLog.mood || (dailyLog.symptoms || []).length || (dailyLog.journal || []).length)) {
    allItems.push({ key: 'daylog', icon: null, card: <DailyLogGroup mood={dailyLog.mood} symptoms={dailyLog.symptoms} journal={dailyLog.journal} none={dailyLog.none}/> })
  }
  day.events.forEach(ev => allItems.push({
    key: ev.id, icon: null,
    card: ev.type === 'appointment'
      ? <AppointmentCard event={ev} highlightId={highlightId} onRemove={onRemoveEvent ? () => onRemoveEvent(ev.id, day.date) : null} onEdit={onEditClinical ? () => onEditClinical(ev) : undefined}/>
      : <EventCard event={ev} highlightId={highlightId} onRemove={onRemoveEvent && ev.type !== 'diagnosis' ? () => onRemoveEvent(ev.id, day.date) : null} onEdit={onEditClinical ? () => onEditClinical(ev) : undefined} visibleRecs={visibleRecs}/>
  }))
  ;(day.suggested || []).forEach((blk, i) => allItems.push({ key: blk.id, isSugBlock: true, icon: <div style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.bgCard, border: `1.5px solid ${C.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-rounded" style={{ fontSize: 20, color: C.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>kid_star</span></div>, card: genBlockId === blk.id
              ? <div style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 13, color: C.textSecondary }}>{genText}</span>
                </div>
              : <SuggestedBlock block={blk} defaultOpen={i===0} onApproachSelect={onApproachSelect} addedIds={addedIds} genState={blockGenStates[blk.id] || 'idle'} onSummarize={onSummarize} basis={treatmentBasis}/> }))
  const lineColor = C.timelineLine  // grey for all regular connections
  const suggestedLineColor = C.timelineLineToday  // orange only adjacent to suggested
  // Find index of last item with an icon
  let lastIconIdx = -1
  allItems.forEach((item, i) => { if (item.icon) lastIconIdx = i })

  return (
    <div style={{ backgroundColor: C.bgApp }}>
      <div ref={sentinelRef} style={{ height: 0 }} data-date={day.date} data-label={day.isToday ? `Today · ${day.label}` : day.label}/>
      <div style={{ backgroundColor: C.bgApp, padding: '16px 16px 12px' }}>
        <div data-dayline={day.date}>
        {day.isToday
          ? <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.primary, letterSpacing: '-0.3px', transition: 'opacity 0.15s', opacity: todayFlash ? 0.5 : 1 }}>Today</span>
              <span style={{ fontSize: 12, color: C.textTertiary, fontWeight: 400 }}>·</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.textSecondary, letterSpacing: '-0.3px' }}>{dayLabel(day.date).shortDate}</span>
            </div>
          : (() => { const { prefix, shortDate } = dayLabel(day.date); return prefix
              ? <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.textSecondary, letterSpacing: '-0.3px' }}>{prefix}</span>
                  <span style={{ fontSize: 12, color: C.textTertiary, fontWeight: 400 }}>·</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.textSecondary, letterSpacing: '-0.3px' }}>{shortDate}</span>
                </div>
              : <span style={{ fontSize: 16, fontWeight: 700, color: C.textSecondary, letterSpacing: '-0.3px' }}>{shortDate}</span>
            })()
        }
        </div>
      </div>
      <div style={{ paddingLeft: 20, paddingRight: 16 }}>
        {allItems.map((item, idx) => {
          const cardKey = `${day.date}-${item.key}`
          const isRevealed = revealedCards.has(cardKey)
          // During generation: cards start invisible until revealed
          // After generation: new cards added by user appear immediately with a fade
          const animStyle = isRevealed
            ? { animation: 'cardfadein 0.5s ease forwards' }
            : generationDone
              ? { animation: 'cardfadein 0.4s ease forwards' }  // new card added after generation
              : { opacity: 0 }
          const isLastIcon = isLastDay && idx === lastIconIdx
          const nextItem = allItems[idx + 1]
          const isSuggested = item.key && (day.suggested || []).some(s => s.id === item.key)
          const nextIsSuggested = nextItem && (day.suggested || []).some(s => s.id === nextItem.key)
          // Line runs below icon unless it's the last icon on last day
          const lineBelow = item.icon && !isLastIcon
          // Gradient: grey→orange when transitioning into suggested, solid orange within suggested, grey otherwise
          // 4 cases for the connector line between this item and the next:
          // event → event: gray
          // event → suggested: gray → orange gradient
          // suggested → event: orange → gray gradient
          // suggested → suggested: orange
          const segmentBg = isSuggested && nextIsSuggested
            ? suggestedLineColor
            : isSuggested && !nextIsSuggested
              ? `linear-gradient(to bottom, ${suggestedLineColor}, ${lineColor})`
              : !isSuggested && nextIsSuggested
                ? `linear-gradient(to bottom, ${lineColor}, ${suggestedLineColor})`
                : lineColor

          if (!item.icon) {
            // No icon (summary card): show line on left, card on right
            // no-icon row: full width card, line left-aligned with icon position
            return (
              <div key={item.key} data-cardkey={cardKey} style={{ ...animStyle }}>
                {item.card}
                {idx < allItems.length - 1 && (
                  <div style={{ height: 32, paddingTop: 8, paddingBottom: 8, paddingLeft: 35, boxSizing: 'border-box' }}>
                    <div style={{ width: 3, height: '100%', background: segmentBg }}/>
                  </div>
                )}
              </div>
            )
          }

          // icon row: full width card, line left-aligned with icon center
          return (
            <div key={item.key} data-cardkey={cardKey} data-recs={isSuggested ? '1' : undefined} style={{ ...animStyle }}>
              {item.card}
              {lineBelow && (
                <div style={{ height: 32, paddingTop: 8, paddingBottom: 8, paddingLeft: 35, boxSizing: 'border-box' }}>
                  <div style={{ width: 3, height: '100%', background: segmentBg }}/>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
const AddEventSheet = ({ onClose, onSelectProcedure, onSelectScan, onSelectMedication, onSelectAppointment }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])

  // Animate sheet out downward, then fire callback once gone
  const dismissThen = (cb) => {
    setVis(false)
    setTimeout(() => { onClose(); cb && cb() }, 280)
  }
  const dismiss = () => dismissThen(null)

  const opts = [
    { type: 'appointment', label: 'Appointment', desc: 'A doctor visit, virtual visit, lab, or other scheduled appointment', fn: onSelectAppointment },
    { type: 'procedure', label: 'Procedure or Surgery', desc: 'A procedure or surgery you had or have scheduled', fn: onSelectProcedure },
    { type: 'medication', label: 'Medication Treatment', desc: 'Start, stop, or adjust a medication', fn: onSelectMedication },
    { type: 'scan', label: 'Scan, Lab, or Pathology Test', desc: 'A scan, lab, or pathology test that was ordered, completed, or scheduled', fn: onSelectScan },
  ]

  return (
    <>
      <div onClick={dismiss} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 50, opacity: vis ? 1 : 0, transition: 'opacity 0.28s ease' }}/>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, borderRadius: '18px 18px 0 0', zIndex: 51, transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '12px auto 0' }}/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 6px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>What would you like to add?</div>
          <button onClick={dismiss} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><Ico.close/></button>
        </div>
        <div style={{ padding: '0 16px 34px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map((o, i) => (
            <button key={i} onClick={() => dismissThen(o.fn)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 15px', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 13, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ flexShrink: 0 }}>{railIcon(o.type)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{o.label}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{o.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

const Toast = ({ message, subtext, action, onDone }) => {
  const [vis, setVis] = useState(false)
  const duration = action ? 3800 : 2400
  const exitDelay = action ? 4200 : 2800
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
    const t1 = setTimeout(() => setVis(false), duration)
    const t2 = setTimeout(onDone, exitDelay)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  return (
    <div style={{
      position: 'absolute', bottom: 96, left: 16, right: 16,
      transform: `translateY(${vis ? 0 : 12}px)`,
      backgroundColor: 'rgba(22,22,22,0.92)', borderRadius: 14,
      padding: subtext ? '12px 16px' : '10px 18px',
      opacity: vis ? 1 : 0, transition: 'opacity 0.25s, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      zIndex: 100, pointerEvents: action ? 'auto' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{message}</div>
        {subtext && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{subtext}</div>}
      </div>
      {action && (
        <button onClick={() => { action.onAction(); onDone() }}
          style={{ flexShrink: 0, fontSize: 14, fontWeight: 700, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'Inter,sans-serif' }}>
          {action.label}
        </button>
      )}
    </div>
  )
}



// ─── REGIMEN DETAIL VIEW ──────────────────────────────────────────
// Treatment detail and regimen data for all RCC treatment sets
// Keyed by RECOMMENDATION_RULES id (RCC_*) for treatment sets
// and by stable regimen id for regimen drill-ins

// ── REGIMEN DETAIL DATA ───────────────────────────────────────────
// Keyed by regimen id from TREATMENT_DETAIL_DATA[*].regimens[*].id

// Fallback for options without specific data
// getRegimenData moved to src/services/treatmentService.js

const SEVERITY_COLOR = { 'Common': '#f59e0b', 'Monitor': '#6366f1', 'Less common': C.textSecondary }

const RegimenDetailView = ({ reg, parentTitle, onClose, onAddToPlan, addedIds = {}, patientState, planItems = [] }) => {
  const data = getRegimenData(reg)
  const regRule = findRuleMatchingItem(reg?.name)
  const isAdded = !!(regRule && addedIds[regRule.id])
  const [vis, setVis] = useState(false)
  const [titleVisible, setTitleVisible] = useState(false)
  const [dockShadow, setDockShadow] = useState(false)
  const [regimenFlow, setRegimenFlow] = useState(null)
  const scrollRef = useRef(null)
  const titleRef = useRef(null)

  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 320) }

  useEffect(() => {
    if (!titleRef.current || !scrollRef.current) return
    const obs = new IntersectionObserver(
      ([e]) => setTitleVisible(!e.isIntersecting),
      { root: scrollRef.current, threshold: 0, rootMargin: '-60px 0px 0px 0px' }
    )
    obs.observe(titleRef.current)
    return () => obs.disconnect()
  }, [])

  const handleScroll = (e) => setDockShadow(e.target.scrollHeight - e.target.scrollTop > e.target.clientHeight + 2)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      transform: vis ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
      display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      <div style={{ display: 'flex', alignItems: 'center', height: 60, paddingLeft: 8, paddingRight: 12, flexShrink: 0, position: 'relative', borderBottom: `1px solid ${titleVisible ? C.border : 'transparent'}`, transition: 'border-color 0.2s' }}>
        <button onClick={dismiss} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <Ico.back/>
        </button>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, opacity: titleVisible ? 1 : 0, transition: 'opacity 0.22s ease', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{data.name}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={() => { if (navigator.share) navigator.share({ title: data.name, text: data.overview }) }} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13 6.5a2 2 0 1 0 0-3 2 2 0 0 0 0 3zM5 10a2 2 0 1 0 0-3 2 2 0 0 0 0 3zM13 14.5a2 2 0 1 0 0-3 2 2 0 0 0 0 3zM7 9.35l4 2.3M11 6.35 7 8.65" stroke={C.textIcon} strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
          <button style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none"><path d="M2 2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v14.5l-5.5-3.5-5.5 3.5V2z" stroke={C.textIcon} strokeWidth="1.4" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

        {/* 1. HEADER */}
        <div style={{ padding: '24px 20px 0' }}>
          <div ref={titleRef} style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 6 }}>{data.name}</div>
          {parentTitle && (
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>{parentTitle}</div>
          )}
          <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65 }}>{data.overview}</p>
          {isAdded && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 20, padding: '5px 13px 5px 8px' }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="9" height="7" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>Added to your plan</span>
            </div>
          )}
        </div>

        {/* 2. SCHEDULE */}
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Schedule</div>
          <div style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '13px 15px' }}>
            <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.6 }}>{data.schedule}</div>
          </div>
        </div>

        {/* 3. WHAT THIS TREATMENT INVOLVES */}
        {data.whatItInvolves?.length > 0 && (
          <div style={{ padding: '24px 20px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>What This Treatment Involves</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.whatItInvolves.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.textTertiary, flexShrink: 0, marginTop: 8 }}/>
                  <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.65 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. ADMINISTRATION */}
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Administration</div>
          <div style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '13px 15px' }}>
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6 }}>{data.administration}</div>
          </div>
        </div>

        {/* 5. WHAT TO EXPECT */}
        {data.whatToExpect?.length > 0 && (
          <div style={{ padding: '24px 20px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>What to Expect</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.whatToExpect.map((item, i) => (
                <div key={i} style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.6 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. SIDE EFFECTS */}
        {data.sideEffects.length > 0 && (
          <div style={{ padding: '24px 20px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Side Effects to Know</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.sideEffects.map((s, i) => (
                <div key={i} style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '13px 15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{s.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: SEVERITY_COLOR[s.severity] || C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.severity}</div>
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.55 }}>{s.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. WHAT'S INCLUDED — moved lower, role description first */}
        {data.components.length > 0 && (
          <div style={{ padding: '24px 20px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>What's Included in This Regimen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.components.map((c, i) => (
                <div key={i} style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '13px 15px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.55, marginBottom: 6 }}>{c.role}</div>
                  <div style={{ fontSize: 12, color: C.textTertiary }}>{c.dose} · {c.schedule}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. MONITORING */}
        {data.monitoring.length > 0 && (
          <div style={{ padding: '24px 20px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Monitoring</div>
            {data.monitoring.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.textTertiary, flexShrink: 0, marginTop: 8 }}/>
                <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.6 }}>{m}</div>
              </div>
            ))}
          </div>
        )}

        {/* 9. QUESTIONS TO ASK YOUR DOCTOR */}
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Questions to Ask Your Doctor</div>
          <button onClick={() => { if (navigator.share) navigator.share({ title: `Questions about ${data.name}`, text: `I have questions about ${data.name}.` }) }} style={{ width: '100%', padding: '14px 16px', backgroundColor: C.bgApp, border: `1px solid ${C.border}`, borderRadius: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke={C.primary} strokeWidth="1.4"/><path d="M10 14v-1M10 11c0-1.5 2-1.5 2-3a2 2 0 1 0-4 0" stroke={C.primary} strokeWidth="1.4" strokeLinecap="round"/></svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>Share with your care team</div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>Prepare questions about this regimen</div>
            </div>
            <Ico.chevRight/>
          </button>
        </div>

        {/* 10. CLINICAL GUIDELINE REFERENCE */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 11, color: C.textTertiary, lineHeight: 1.6 }}>
            {data.source}
            {data.category?.includes('NCCN') && (
              <span> {data.category.split(' · ').find(p => p.startsWith('NCCN'))}</span>
            )}
          </div>
        </div>

      </div>

      {/* Docked button */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, padding: '12px 20px 34px', boxShadow: dockShadow ? '0 -4px 12px rgba(0,0,0,0.08)' : 'none', transition: 'box-shadow 0.2s' }}>
        <button onClick={() => setRegimenFlow(data.type || 'medication')} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white' }}>
          Add to plan
        </button>
      </div>

      {/* Flow slides up over regimen detail */}
      {regimenFlow === 'procedure' && (
        <AddProcedureFlow
          onClose={() => setRegimenFlow(null)}
          onComplete={(event) => { setRegimenFlow(null); onAddToPlan(event, true) }}
          preload={{ name: data.name, subtitle: data.category, searchTerms: [data.name.toLowerCase()] }}
          fromDetail={true}
          planItems={planItems}
          patientState={patientState}
        />
      )}
      {regimenFlow === 'scan' && (
        <AddScanFlow
          onClose={() => setRegimenFlow(null)}
          onComplete={(event) => { setRegimenFlow(null); onAddToPlan(event, true) }}
          preload={{ name: data.name, subtitle: data.category, searchTerms: [data.name.toLowerCase()] }}
          fromDetail={true}
          planItems={planItems}
          patientState={patientState}
        />
      )}
      {regimenFlow === 'medication' && (
        <AddMedicationFlow
          onClose={() => setRegimenFlow(null)}
          onComplete={(event) => { setRegimenFlow(null); onAddToPlan(event, true) }}
          preload={{ name: data.name, subtitle: data.category, searchTerms: [data.name.toLowerCase()] }}
          fromDetail={true}
          planItems={planItems}
          patientState={patientState}
        />
      )}
    </div>
  )
}

// getDetailData moved to src/services/treatmentService.js

// Bottom sheet for choosing a regimen when "Add to plan" is tapped on a treatment
// set with multiple options. Slides up from the bottom (vis + double-rAF) like the
// other sheets, and fades its backdrop, instead of appearing instantly.
const PickerSheet = ({ regimens = [], addedIds = {}, onClose, onPick }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 300) }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 68 }}>
      <div onClick={dismiss} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', opacity: vis ? 1 : 0, transition: 'opacity 0.3s ease' }}/>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, borderRadius: '16px 16px 0 0', padding: '20px 20px 34px', maxHeight: '70%', overflowY: 'auto', transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, margin: '0 auto 16px' }}/>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Choose a treatment to add</div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>Select the specific regimen you'd like to add to your plan</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 13, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          {regimens.map((reg, i) => {
            const rule = findRuleMatchingItem(reg.name)
            const isOnPlan = rule && addedIds[rule.id]
            return (
              <button key={reg.id}
                onClick={() => onPick(reg)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', backgroundColor: C.bgCard, border: 'none', borderBottom: i < regimens.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ flexShrink: 0 }}>{railIcon('medication')}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, lineHeight: 1.3 }}>{reg.name}</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginTop: 3 }}>{reg.description}</div>
                  {isOnPlan && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>Added</span>
                    </div>
                  )}
                </div>
                <Ico.chevRight/>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const TreatmentDetailView = ({ opt, onClose, onAddToPlan, addedIds = {}, patientState, planItems = [] }) => {
  const data = getDetailData(opt)
  const [vis, setVis] = useState(false)
  const [titleVisible, setTitleVisible] = useState(false)
  const [dockShadow, setDockShadow] = useState(false)
  const [detailFlow, setDetailFlow] = useState(null)
  const [detailFlowPreload, setDetailFlowPreload] = useState(null)
  const [selectedRegimen, setSelectedRegimen] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const scrollRef = useRef(null)
  const titleRef = useRef(null)

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
  }, [])

  const dismiss = () => { setVis(false); setTimeout(onClose, 320) }

  // IntersectionObserver to detect when page title scrolls out of view
  useEffect(() => {
    if (!titleRef.current || !scrollRef.current) return
    const obs = new IntersectionObserver(
      ([e]) => setTitleVisible(!e.isIntersecting),
      { root: scrollRef.current, threshold: 0, rootMargin: '-60px 0px 0px 0px' }
    )
    obs.observe(titleRef.current)
    return () => obs.disconnect()
  }, [])

  // Detect scroll to show dock shadow
  const handleScroll = (e) => setDockShadow(e.target.scrollHeight - e.target.scrollTop > e.target.clientHeight + 2)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 65,
      transform: vis ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
      display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Shared app bar */}

      <div style={{ display: 'flex', alignItems: 'center', height: 60, paddingLeft: 8, paddingRight: 12, flexShrink: 0, position: 'relative', borderBottom: `1px solid ${titleVisible ? C.border : 'transparent'}`, transition: 'border-color 0.2s' }}>
        {/* Back */}
        <button onClick={dismiss} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <Ico.back/>
        </button>
        {/* Title — fades in when page title scrolls out */}
        <div style={{ flex: 1, textAlign: 'center', opacity: titleVisible ? 1 : 0, transition: 'opacity 0.22s ease' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px', maxWidth: 'calc(100% - 80px)' }}>{data.title}</div>
        </div>
        {/* Share + Bookmark */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => { if (navigator.share) navigator.share({ title: data.title, text: data.description }) }} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13 6.5a2 2 0 1 0 0-3 2 2 0 0 0 0 3zM5 10a2 2 0 1 0 0-3 2 2 0 0 0 0 3zM13 14.5a2 2 0 1 0 0-3 2 2 0 0 0 0 3zM7 9.35l4 2.3M11 6.35 7 8.65" stroke={C.textIcon} strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
          <button style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none"><path d="M2 2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v14.5l-5.5-3.5-5.5 3.5V2z" stroke={C.textIcon} strokeWidth="1.4" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

        {/* 1. HEADER — title + short description */}
        <div style={{ padding: '24px 20px 0' }}>
          <div ref={titleRef} style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 6 }}>{data.title}</div>
          <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, marginBottom: 0 }}>{data.description}</p>
        </div>

        {/* 2. TREATMENT OPTIONS — highest priority, shown first */}
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Treatment Options</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 13, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {(data.regimens || []).map((reg, i) => {
              const rule = findRuleMatchingItem(reg.name)
              const isOnPlan = rule && addedIds[rule.id]
              return (
                <button key={reg.id} onClick={() => setSelectedRegimen(reg)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', backgroundColor: C.bgCard, border: 'none', borderBottom: i < data.regimens.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ flexShrink: 0 }}>{railIcon('medication')}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, lineHeight: 1.3 }}>{reg.name}</div>
                    <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginTop: 3 }}>{reg.description}</div>
                      {isOnPlan && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>Added</span>
                        </div>
                      )}
                  </div>
                  <Ico.chevRight/>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. WHAT THIS APPROACH MEANS */}
        <div style={{ padding: '28px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>What This Approach Means</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data.goals || []).map((goal, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.textTertiary, flexShrink: 0, marginTop: 8 }}/>
                <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.65 }}>{goal}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. WHAT TO CONSIDER */}
        <div style={{ padding: '28px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>What to Consider</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.overview || []).map((item, i) => (
              <div key={i} style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '13px 15px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. QUESTIONS TO ASK YOUR DOCTOR */}
        <div style={{ padding: '28px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Questions to Ask Your Doctor</div>
          <button onClick={() => { if (navigator.share) navigator.share({ title: `Questions about ${data.title}`, text: `I have questions about ${data.title} as a treatment option.` }) }} style={{ width: '100%', padding: '14px 16px', backgroundColor: C.bgApp, border: `1px solid ${C.border}`, borderRadius: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke={C.primary} strokeWidth="1.4"/><path d="M10 14v-1M10 11c0-1.5 2-1.5 2-3a2 2 0 1 0-4 0" stroke={C.primary} strokeWidth="1.4" strokeLinecap="round"/></svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>Share with your care team</div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>Prepare questions about this treatment option</div>
            </div>
            <Ico.chevRight/>
          </button>
        </div>

        {/* 6. GUIDELINE REFERENCE — minimal */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 11, color: C.textTertiary, lineHeight: 1.6 }}>
            {data.source}
            {data.clinicalClass?.includes('NCCN') && (
              <span> {data.clinicalClass.split(' · ').find(p => p.startsWith('NCCN'))}</span>
            )}
          </div>
        </div>

      </div>

      {/* Docked Add to Plan — smart: shows picker if regimens exist, else goes straight to flow */}
      {(() => {
        const hasRegimens = data.regimens && data.regimens.length > 0

        return (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, padding: '12px 20px 34px', boxShadow: dockShadow ? '0 -4px 12px rgba(0,0,0,0.08)' : 'none', transition: 'box-shadow 0.2s' }}>
            <button
              onClick={() => {
                if (hasRegimens) {
                  setShowPicker(true)
                } else {
                  setDetailFlow(data.type || 'medication')
                }
              }}
              style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white' }}>
              Add to plan
            </button>
          </div>
        )
      })()}

      {/* Inline picker sheet — slides up when "Add to plan" tapped with regimens */}
      {showPicker && (
        <PickerSheet
          regimens={data.regimens || []}
          addedIds={addedIds}
          onClose={() => setShowPicker(false)}
          onPick={(reg) => {
            setShowPicker(false)
            setDetailFlowPreload({ name: reg.name, subtitle: reg.category, searchTerms: [reg.name.toLowerCase()] })
            setDetailFlow(data.type || 'medication')
          }}
        />
      )}

      {/* Regimen detail — slides in over treatment detail */}
      {selectedRegimen && (
        <RegimenDetailView
          reg={selectedRegimen}
          parentTitle={data.title}
          onClose={() => setSelectedRegimen(null)}
          addedIds={addedIds}
          patientState={patientState}
          planItems={planItems}
          onAddToPlan={(event, fromFlow) => {
            if (fromFlow) {
              setSelectedRegimen(null)
              onAddToPlan({ ...event, createdFromRecommendationId: event.createdFromRecommendationId || opt?.id }, true)
            }
          }}
        />
      )}

      {/* Flow slides up over detail — stays mounted on top */}
      {detailFlow === 'procedure' && (
        <AddProcedureFlow
          onClose={() => { setDetailFlow(null); setDetailFlowPreload(null) }}
          onComplete={(event) => { setDetailFlow(null); setDetailFlowPreload(null); onAddToPlan({ ...event, createdFromRecommendationId: opt?.id }, true) }}
          preload={detailFlowPreload || { name: data.title, subtitle: data.clinicalClass, searchTerms: [data.title.toLowerCase()] }}
          fromDetail={true}
          planItems={planItems}
          patientState={patientState}
        />
      )}
      {detailFlow === 'scan' && (
        <AddScanFlow
          onClose={() => { setDetailFlow(null); setDetailFlowPreload(null) }}
          onComplete={(event) => { setDetailFlow(null); setDetailFlowPreload(null); onAddToPlan({ ...event, createdFromRecommendationId: opt?.id }, true) }}
          preload={detailFlowPreload || { name: data.title, subtitle: data.clinicalClass, searchTerms: [data.title.toLowerCase()] }}
          fromDetail={true}
          planItems={planItems}
          patientState={patientState}
        />
      )}
      {detailFlow === 'medication' && (
        <AddMedicationFlow
          onClose={() => { setDetailFlow(null); setDetailFlowPreload(null) }}
          onComplete={(event) => { setDetailFlow(null); setDetailFlowPreload(null); onAddToPlan({ ...event, createdFromRecommendationId: opt?.id }, true) }}
          preload={detailFlowPreload || { name: data.title, subtitle: data.clinicalClass, searchTerms: [data.title.toLowerCase()] }}
          fromDetail={true}
          planItems={planItems}
          patientState={patientState}
        />
      )}
    </div>
  )
}




// ─── ONBOARDING ───────────────────────────────────────────────────


// ─── AUTH SCREENS ────────────────────────────────────────────────

const AuthScreen = ({ onLogin, onNewUser }) => {
  const [view, setView] = useState('landing') // 'landing' | 'login' | 'create'
  const [vis, setVis] = useState(true)

  // Animate out then call handler — defined before early returns so it's in scope
  const exitThen = (fn) => { setVis(false); setTimeout(fn, 360) }

  if (view === 'login')  return <LoginView  onBack={() => setView('landing')} onSuccess={(u) => exitThen(() => onLogin(u))}/>
  if (view === 'create') return <CreateView onBack={() => setView('landing')} onSuccess={(u) => exitThen(() => onLogin(u))}/>

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 95, backgroundColor: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* Front door (redesign-04) — no account, no diagnosis needed. One path in;
          "Sign in" stays as a quiet link for people who already have an account. */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'calc(32px + env(safe-area-inset-top, 0px)) 28px 24px', maxWidth: 440, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <img src={OUTCOMES_LOGO_SRC} alt="Outcomes4Me" style={{ display: 'block', alignSelf: 'flex-start', height: 30, width: 'auto', maxWidth: '100%', marginBottom: 36 }}/>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.7px', color: C.textPrimary, lineHeight: 1.2 }}>
          Understand your cancer, build a plan, and walk into your appointments prepared.
        </div>
      </div>

      <div style={{ padding: '0 28px 12px', maxWidth: 440, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button onClick={() => exitThen(onNewUser)} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white', fontFamily: 'Inter,sans-serif' }}>
          Get started
        </button>
        <div style={{ textAlign: 'center', fontSize: 14, color: C.textSecondary, padding: '16px 0 4px' }}>
          Already have an account?{' '}
          <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary, fontFamily: 'Inter,sans-serif' }}>Sign in</button>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px', textAlign: 'center', fontSize: 11, color: C.textTertiary, lineHeight: 1.6 }}>
        By continuing you agree to our Terms of Service and Privacy Policy.
      </div>
    </div>
  )
}

const LoginView = ({ onBack, onSuccess }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [vis, setVis] = useState(false)
  const [exitDir, setExitDir] = useState(null) // 'back' | 'success'
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])

  const dismiss = (dir, fn) => {
    setExitDir(dir)
    setVis(false)
    setTimeout(fn, 300)
  }

  const handleLogin = () => {
    setError('')
    setLoading(true)
    setTimeout(() => {
      const result = login(email, password)
      setLoading(false)
      if (result.ok) dismiss('success', () => onSuccess(result.user))
      else setError(result.error)
    }, 400)
  }

  const translateX = vis ? 'translateX(0)' : exitDir === 'back' ? 'translateX(100%)' : 'translateX(0)'
  const translateY = vis ? 'translateY(0)' : exitDir === 'success' ? 'translateY(-16px)' : 'translateY(0)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 95, backgroundColor: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      opacity: vis ? 1 : 0,
      transform: `${translateX} ${translateY}`,
      transition: vis ? 'opacity 0.26s ease-out, transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)'
                      : 'opacity 0.26s ease-in, transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
    }}>

      <div style={{ display: 'flex', alignItems: 'center', height: 44, paddingLeft: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Ico.back/>
        </button>
      </div>
      <div style={{ flex: 1, padding: '8px 28px 32px', overflowY: 'auto' }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 8 }}>Sign in</div>
        <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 32 }}>Welcome back.</div>

        <AuthField label="Email" value={email} onChange={setEmail} type="email" placeholder="your@email.com"/>
        <AuthField label="Password" value={password} onChange={setPassword} type="password" placeholder="Your password"/>

        {error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: 8 }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading || !email || !password}
          style={{ width: '100%', height: 52, borderRadius: 26, backgroundColor: (loading || !email || !password) ? '#e0e0e0' : C.primary, border: 'none', cursor: (loading || !email || !password) ? 'default' : 'pointer', fontSize: 16, fontWeight: 600, color: (loading || !email || !password) ? '#aaa' : 'white', marginBottom: 20 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 12, color: C.textTertiary, padding: '12px', backgroundColor: C.bgApp, borderRadius: 10 }}>
          Demo: <span style={{ color: C.primary, fontWeight: 500 }}>nick@demo.com</span> / <span style={{ color: C.primary, fontWeight: 500 }}>demo1234</span>
        </div>
      </div>
    </div>
  )
}

const CreateView = ({ onBack, onSuccess }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [vis, setVis] = useState(false)
  const [exitDir, setExitDir] = useState(null)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])

  const dismiss = (dir, fn) => {
    setExitDir(dir)
    setVis(false)
    setTimeout(fn, 300)
  }

  const handleCreate = () => {
    setError('')
    setLoading(true)
    setTimeout(() => {
      const result = createAccount(name, email, password)
      setLoading(false)
      if (result.ok) dismiss('success', () => onSuccess(result.user))
      else setError(result.error)
    }, 400)
  }

  const valid = name.trim() && email.includes('@') && password.length >= 6

  const translateX = vis ? 'translateX(0)' : exitDir === 'back' ? 'translateX(100%)' : 'translateX(0)'
  const translateY = vis ? 'translateY(0)' : exitDir === 'success' ? 'translateY(-16px)' : 'translateY(0)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 95, backgroundColor: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      opacity: vis ? 1 : 0,
      transform: `${translateX} ${translateY}`,
      transition: vis ? 'opacity 0.26s ease-out, transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)'
                      : 'opacity 0.26s ease-in, transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
    }}>

      <div style={{ display: 'flex', alignItems: 'center', height: 44, paddingLeft: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Ico.back/>
        </button>
      </div>
      <div style={{ flex: 1, padding: '8px 28px 32px', overflowY: 'auto' }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 8 }}>Create account</div>
        <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 32 }}>Start building your personalised care plan.</div>

        <AuthField label="Name" value={name} onChange={setName} type="text" placeholder="Your name" required/>
        <AuthField label="Email" value={email} onChange={setEmail} type="email" placeholder="your@email.com" required/>
        <AuthField label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" required
          hint={password.length > 0 && password.length < 6 ? 'At least 6 characters required' : null}/>

        {error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: 8 }}>{error}</div>}

        <button onClick={handleCreate} disabled={loading || !valid}
          style={{ width: '100%', height: 52, borderRadius: 26, backgroundColor: (loading || !valid) ? '#e0e0e0' : C.primary, border: 'none', cursor: (loading || !valid) ? 'default' : 'pointer', fontSize: 16, fontWeight: 600, color: (loading || !valid) ? '#aaa' : 'white', marginBottom: 16 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <div style={{ fontSize: 11, color: C.textTertiary, textAlign: 'center', lineHeight: 1.6 }}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  )
}

const AuthField = ({ label, value, onChange, type, placeholder, required, hint }) => {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary, marginBottom: 6 }}>{label}{required && <span style={{ color: C.primary }}> *</span>}</div>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', height: 48, border: `${focused ? 2 : 1}px solid ${focused ? C.primary : C.border}`, borderRadius: 12, padding: '0 14px', fontSize: 15, color: C.textPrimary, backgroundColor: '#fff', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
      />
      {hint && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

// ─── CANCER TYPE CATALOG ─────────────────────────────────────────
// Short list for onboarding — Kidney first (full recommendation engine),
// then common cancers. Surgery names map directly to PROCEDURE_CATALOG.
const CANCER_TYPES = [
  { code: 'RCC',    name: 'Kidney Cancer',              subtitle: 'Renal cell carcinoma (RCC)', surgery: 'Nephrectomy' },
  { code: 'BREAST', name: 'Breast Cancer',              subtitle: null,                          surgery: 'Lumpectomy' },
  { code: 'CRC',    name: 'Colorectal Cancer',          subtitle: 'Colon or rectal cancer',      surgery: 'Colectomy' },
  { code: 'LUNG',   name: 'Lung Cancer',                subtitle: null,                          surgery: 'Lung surgery' },
  { code: 'PROS',   name: 'Prostate Cancer',            subtitle: null,                          surgery: 'Prostatectomy' },
  { code: 'BLAD',   name: 'Bladder Cancer',             subtitle: null,                          surgery: 'Cystectomy' },
  { code: 'OV',     name: 'Ovarian Cancer',             subtitle: null,                          surgery: 'Debulking / cytoreductive surgery' },
  { code: 'LEUK',   name: 'Leukemia',                   subtitle: 'ALL, AML, CLL, CML',          surgery: null },
  { code: 'LYMP',   name: 'Lymphoma',                   subtitle: 'Hodgkin or Non-Hodgkin',      surgery: null },
  { code: 'MM',     name: 'Multiple Myeloma',           subtitle: null,                          surgery: 'Autologous stem cell transplant' },
]

// ─── CLINICAL HELPERS (module-level: shared by onboarding, gap answers, ClinicalEditSheet) ──
const _daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d) }

const _STAGE_ROMAN_LABEL = { I: 'Stage I', II: 'Stage II', III: 'Stage III', IV: 'Stage IV' }
const _EXTENT_DETAIL = { one_place: 'In one place', nodes: 'Spread to nearby lymph nodes', spread: 'Spread to other parts of the body', early: 'Described as early' }

// The diagnosis is placed on the timeline. Onboarding no longer asks the diagnosis date, so
// a new record places it on the day it was added (never a made-up past date). Legacy
// answers (diagnosis_date, treatment_status = surgery) still seed as before.
const buildSeedEventsFromAnswers = (ans, cancer, stage, hadSurgery, addedDate) => {
  const diagDate = ans.diagnosis_date || addedDate || _daysAgoStr(14)
  const events = []
  events.push({ date: diagDate, event: {
    id: 'seed_diag', type: 'diagnosis', source: 'onboarding',
    name: cancer ? cancer.name : 'Cancer — type not confirmed yet', date: diagDate,
    details: [
      ans.stage && ans.stage !== 'unsure' ? _STAGE_ROMAN_LABEL[stage] : (_EXTENT_DETAIL[ans.extent] || null),
      ans.histology === 'clear_cell' ? 'Clear cell histology' : ans.histology === 'non_clear' ? 'Non-clear cell histology' : null,
    ].filter(Boolean),
  }})
  if (hadSurgery) {
    events.push({ date: _daysAgoStr(10), event: { id: 'seed_surgery', type: 'procedure', source: 'onboarding', name: 'Surgery', date: _daysAgoStr(10) }})
    events.push({ date: _daysAgoStr(4),  event: { id: 'seed_pathology', type: 'procedure', source: 'onboarding', name: 'Pathology review', date: _daysAgoStr(4) }})
  }
  if (stage === 'IV' && ans.stage) {
    events.push({ date: diagDate, event: { id: 'seed_staging', type: 'scan', source: 'onboarding', name: 'Staging CT scan', date: diagDate }})
  }
  return events
}

// opts.onboardedDate: set on first onboarding (drives the first-run welcome summary and
// the reload check). opts.dateOfBirth: from account creation. Both are record facts that
// don't come from the answers, so every rebuild must pass them through (see recordFacts).
const recordFacts = (ps = {}) => ({ onboardedDate: ps.onboardedDate || null, dateOfBirth: ps.dateOfBirth || null, patientFullName: ps.patientFullName || null })
const buildPatientStateFromAnswers = (ans, opts = {}) => {
  const typeKnown = ans.cancer_type && ans.cancer_type !== 'unsure'
  const cancer = typeKnown ? (CANCER_TYPES.find(c => c.code === ans.cancer_type) || null) : null
  const stage = stageFromAnswers(ans)   // null when unknown — never a silent default
  const hadSurgery = ans.treatment_status === 'surgery'
  return {
    patientState: {
      diagnosisCode: cancer ? cancer.code : null,
      stage,
      biomarkers: { histology: ans.histology === 'clear_cell' ? 'clear-cell' : ans.histology === 'non_clear' ? 'non-clear-cell' : 'unknown' },
      performanceStatus: 0,
      cancerName: cancer ? cancer.name : null,
      treatmentPhase: ans.treatment_phase || null,
      role: ans.role || 'self',
      patientName: ans.role === 'caregiver' ? (ans.patient_name || null) : null,
      relationship: ans.role === 'caregiver' ? (ans.relationship || null) : null,
      ageRange: ans.role === 'caregiver' ? (ans.patient_age_range || null) : null,  // only when the DOB isn't known
      onboardedDate: opts.onboardedDate || null,
      dateOfBirth: opts.dateOfBirth || null,
      patientFullName: opts.patientFullName || null,
      onboardingAnswers: ans,
    },
    seedEvents: buildSeedEventsFromAnswers(ans, cancer, stage, hadSurgery, opts.onboardedDate || opts.addedDate),
  }
}

// ─── ONBOARDING (redesign-04) ─────────────────────────────────────
// One flow: front door (AuthScreen) → 4 plain-language questions → create
// account → Today. Answers are held in component state (pre-registration cache) and
// only written to the record once the account exists. "Not sure" is a real answer on
// every clinical question: it produces a partial record and plants a gap, which
// resurfaces in Today's next steps as a one-tap item straight back to that question.
//
// Answer keys (stored on patientState.onboardingAnswers):
//   cancer_type     CANCER_TYPES code | 'unsure'
//   extent          'one_place' | 'nodes' | 'spread' | 'early' | 'unsure'
//   treatment_phase 'just_diagnosed' | 'in_treatment' | 'finished' | 'unsure'
//   role            'self' | 'caregiver'   (a label — changes copy only)
//   drivers         'tested' | 'planned' | 'not_tested' | 'unsure'  (asked later, from a gap)
// Legacy keys (stage, histology, treatment_status) are still honoured — ClinicalEditSheet
// writes them for records created by the earlier onboarding.
// STRAWMAN: the fields and the extent→stage mapping are placeholders until the real
// NCCN essentials list replaces them.

// ─── Patient copy — see services/patientCopy.js for the rule and tokens ───────
// One string per sentence; {they}/{their}/{are|is}… fill in "you" (self) or the name a
// caregiver gave ("Mom"). Components read the subject from context; module-level builders
// take it as an argument.
const PatientCopyContext = createContext(careSubject(null))
const usePatientCopy = () => {
  const sub = useContext(PatientCopyContext)
  const t = useCallback((tpl) => fillCopy(tpl, sub), [sub])
  t.sub = sub
  return t
}

const ONB_FEATURED_CANCERS = ['RCC', 'BREAST', 'LUNG', 'CRC', 'PROS']
const _cancerDisplay = (c) => c.name.replace(/ Cancer$/, ' cancer')

// The questions, written once and shared by onboarding AND the one-tap gap sheet.
const ONB_QUESTIONS = {
  extent: {
    key: 'extent',
    title: 'What have you been told about where it is?',
    opts: [
      { value: 'one_place', label: "It's in one place" },
      { value: 'nodes',     label: "It's spread to nearby lymph nodes" },
      { value: 'spread',    label: "It's spread to other parts of {my|{their}} body" },
      { value: 'early',     label: "{I've|We've} been told it's early" },
      { value: 'unsure',    label: "{I haven't|We haven't} been told / {I'm|we're} not sure" },
    ],
  },
  treatment_phase: {
    key: 'treatment_phase',
    title: 'Where {are|is} {they} right now?',
    opts: [
      { value: 'just_diagnosed', label: "Just diagnosed, {haven't|hasn't} started treatment" },
      { value: 'in_treatment',   label: 'In treatment now' },
      { value: 'finished',       label: 'Finished treatment' },
      { value: 'unsure',         label: 'Not sure' },
    ],
  },
  role: {
    key: 'role',
    title: 'Who are you setting this up for?',
    opts: [
      { value: 'self',      label: 'Myself' },
      { value: 'caregiver', label: "Someone I'm caring for" },
    ],
  },
  drivers: {
    key: 'drivers',
    title: "Has anyone talked with you about what's driving {their} cancer?",
    hint: 'Things like biomarkers or gene changes found by testing {your|the} tumor. These can open up more options.',
    opts: [
      { value: 'tested',     label: 'Yes — {I|we} have test results' },
      { value: 'planned',    label: 'Testing is planned or in progress' },
      { value: 'not_tested', label: "{I haven't|{They} hasn't} been tested" },
      { value: 'unsure',     label: "I'm not sure" },
    ],
  },
}

// Extent (plain language) → the engine's stage input. Explicit legacy stage wins.
const _EXTENT_STAGE = { one_place: 'I', early: 'I', nodes: 'III', spread: 'IV' }
const _LEGACY_STAGE = { stage_1: 'I', stage_2: 'II', stage_3: 'III', stage_4: 'IV' }
const stageFromAnswers = (ans = {}) => _LEGACY_STAGE[ans.stage] || _EXTENT_STAGE[ans.extent] || null

// Gaps = what this unlocks. Derived from the answers (one source of truth), so answering
// a question anywhere closes its gap everywhere. "Not sure" leaves the gap open.
const deriveQuestionGaps = (ans) => {
  if (!ans) return []
  const gaps = []
  const typeKnown = ans.cancer_type && ans.cancer_type !== 'unsure'
  if (!typeKnown) gaps.push({ id: 'q_type', kind: 'q-type', question: 'cancer_type', state: 'question' })
  if (typeKnown && !stageFromAnswers(ans)) gaps.push({ id: 'q_stage', kind: 'q-stage', question: 'extent', state: 'question' })
  if (typeKnown && (!ans.drivers || ans.drivers === 'unsure')) gaps.push({ id: 'q_drivers', kind: 'q-drivers', question: 'drivers', state: 'question' })
  if (!ans.treatment_phase || ans.treatment_phase === 'unsure') {
    // Legacy records answered treatment_status instead — don't re-ask them.
    if (!ans.treatment_status || ans.treatment_status === 'unsure') gaps.push({ id: 'q_treatment', kind: 'q-treatment', question: 'treatment_phase', state: 'question' })
  }
  return gaps
}

// Shared question primitive — radio-style options. Tapping selects, shows the choice
// briefly, then calls onPick (so the selection registers visually before advancing).
const OnbQuestion = ({ title: titleTpl, hint: hintTpl, opts: optsTpl, value, onPick, footer = null }) => {
  const t = usePatientCopy()
  const title = t(titleTpl), hint = t(hintTpl)
  const opts = optsTpl.map(o => ({ ...o, label: t(o.label) }))
  const [picked, setPicked] = useState(value || null)
  const pick = (v) => { setPicked(v); setTimeout(() => onPick(v), 180) }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 24px 40px', overflowY: 'auto' }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.25, marginBottom: hint ? 10 : 26 }}>{title}</div>
      {hint && <div style={{ fontSize: 14.5, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>{hint}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {opts.map(o => {
          const on = picked === o.value
          return (
            <button key={o.value} onClick={() => pick(o.value)} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', padding: '15px 16px', borderRadius: 14, border: `${on ? 1.5 : 1}px solid ${on ? C.primary : C.border}`, backgroundColor: on ? C.primaryLight : C.bgCard, cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'background-color 0.15s, border-color 0.15s' }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${on ? C.primary : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.15s' }}>
                {on && <span style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: C.primary }}/>}
              </span>
              <span style={{ fontSize: 15.5, fontWeight: 500, color: C.textPrimary, lineHeight: 1.35 }}>{o.label}</span>
            </button>
          )
        })}
      </div>
      {footer}
    </div>
  )
}

// Cancer type — search + a short featured list + an honest "not sure" exit.
const OnbCancerType = ({ value, onPick, showNote = false }) => {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const list = term
    ? CANCER_TYPES.filter(c => c.name.toLowerCase().includes(term) || (c.subtitle || '').toLowerCase().includes(term))
    : ONB_FEATURED_CANCERS.map(code => CANCER_TYPES.find(c => c.code === code))
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 24px 40px', overflowY: 'auto' }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.25, marginBottom: showNote ? 8 : 20 }}>What type of cancer are you dealing with?</div>
      {/* Sets the expectation for the whole flow on its first screen (the old separate
          "Let's build your plan" screen felt like a second Get started). */}
      {showNote && <div style={{ fontSize: 14.5, color: C.textSecondary, lineHeight: 1.55, marginBottom: 20 }}>A few quick questions to build your plan. Not sure about something? That's okay, you can add it later.</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 48, padding: '0 14px', borderRadius: 12, backgroundColor: C.bgApp, marginBottom: 14 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 21, color: C.textTertiary }}>search</span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" aria-label="Search cancer types" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: C.textPrimary, fontFamily: 'Inter,sans-serif' }}/>
        {q && <button onClick={() => setQ('')} aria-label="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><span className="material-symbols-rounded" style={{ fontSize: 19, color: C.textTertiary }}>close</span></button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {list.map(c => {
          const on = value === c.code
          return (
            <button key={c.code} onClick={() => onPick(c.code)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '15px 4px', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: on ? 600 : 500, color: on ? C.primary : C.textPrimary }}>{_cancerDisplay(c)}</span>
                {term && c.subtitle && <span style={{ display: 'block', fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{c.subtitle}</span>}
              </span>
              {on && <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.primary }}>check</span>}
            </button>
          )
        })}
        {term && list.length === 0 && <div style={{ fontSize: 14, color: C.textTertiary, padding: '16px 4px' }}>No matches for “{q.trim()}”.</div>}
      </div>
      <button onClick={() => onPick('unsure')} style={{ alignSelf: 'flex-start', marginTop: 18, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: C.primary, fontFamily: 'Inter,sans-serif' }}>
        I'm not sure of the exact type →
      </button>
    </div>
  )
}

// Create account, step 1 — choose how to sign in (honest privacy framing). Email expands an
// inline email + password form; Apple/Google are simulated provider sign-ins. Nothing is
// created yet: the chosen credentials go forward to the "About you" step.
const _onbBtn = (primary) => ({ width: '100%', height: 54, borderRadius: 9999, border: primary ? 'none' : `1.5px solid ${C.border}`, backgroundColor: primary ? C.primary : C.bgCard, color: primary ? '#fff' : C.textPrimary, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 12 })
const OnbAccount = ({ creds, onContinue, error: externalError = '' }) => {
  const [mode, setMode] = useState(creds?.provider === 'email' ? 'email' : 'choose') // 'choose' | 'email'
  const [email, setEmail] = useState(creds?.email || '')
  const [password, setPassword] = useState(creds?.password || '')
  const [error, setError] = useState('')
  const valid = email.includes('@') && password.length >= 6
  const continueEmail = () => {
    if (!valid) return
    const r = checkEmailAvailable(email)
    if (!r.ok) { setError(r.error); return }
    onContinue({ provider: 'email', email, password })
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 24px 36px', overflowY: 'auto' }}>
      <div style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 25, color: C.textIcon, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>lock</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.25, marginBottom: 10 }}>Create a new account</div>
      <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.6, marginBottom: 28 }}>Because this is your health information, you'll need an account to keep it safe and come back to it.</div>
      <div style={{ flex: 1 }}>
        {mode === 'email' && (
          <div style={{ marginBottom: 6 }}>
            <AuthField label="Email" value={email} onChange={v => { setEmail(v); setError('') }} type="email" placeholder="your@email.com" required/>
            <AuthField label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" required
              hint={password.length > 0 && password.length < 6 ? 'At least 6 characters required' : null}/>
          </div>
        )}
        {(error || externalError) && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: 8 }}>{error || externalError}</div>}
      </div>
      {mode === 'email' ? (
        <>
          <button onClick={continueEmail} style={{ ..._onbBtn(true), opacity: valid ? 1 : 0.45, cursor: valid ? 'pointer' : 'default' }}>Continue</button>
          <button onClick={() => { setMode('choose'); setError('') }} style={{ ..._onbBtn(false), border: 'none', color: C.textSecondary, fontWeight: 500 }}>Other ways to continue</button>
        </>
      ) : (
        <>
          <button onClick={() => setMode('email')} style={_onbBtn(true)}>
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>mail</span>Continue with email
          </button>
          <button onClick={() => onContinue({ provider: 'apple' })} style={_onbBtn(false)}>
            <svg width="17" height="20" viewBox="0 0 17 20" aria-hidden><path fill={C.textPrimary} d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.9 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.8 3.4-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1-3-4.4zM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>
            Continue with Apple
          </button>
          <button onClick={() => onContinue({ provider: 'google' })} style={_onbBtn(false)}>
            <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
        </>
      )}
      <div style={{ fontSize: 11, color: C.textTertiary, textAlign: 'center', lineHeight: 1.6, marginTop: 4 }}>By continuing you agree to our Terms of Service and Privacy Policy.</div>
    </div>
  )
}

// Caregiver only — who the record is about. Name + relationship drive every reference
// to the patient afterwards ("your mom", "Alex").
// Age is what the app uses (guidance + content), so a caregiver who doesn't know the exact
// birthday gives an approximate range instead — never blocked. The exact date is asked at
// share time, with the full name, when the care team needs it.
const AGE_RANGES = [
  { value: 'under_40', label: 'Under 40' },
  { value: '40_64',    label: '40–64' },
  { value: '65_plus',  label: '65 and older' },
  { value: 'unsure',   label: 'Not sure' },
]
const ageRangeLabel = (v) => (AGE_RANGES.find(a => a.value === v) || {}).label || null
const OnbPatient = ({ name = '', relationship = null, dob = '', ageRange = null, onContinue }) => {
  const [n, setN] = useState(name)
  const [rel, setRel] = useState(relationship)
  const [bd, setBd] = useState(dob)
  const [dobUnknown, setDobUnknown] = useState(!dob && !!ageRange)
  const [age, setAge] = useState(ageRange)
  const today = localDateStr()
  const thisYear = new Date().getFullYear()
  const shown = careName(n)
  const valid = n.trim() && rel && (dobUnknown ? !!age : (bd && bd <= today))
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 24px 36px', overflowY: 'auto' }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.25, marginBottom: 10 }}>Who are you caring for?</div>
      <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>Their plan, check-ins, and notes will be about them — you're keeping track on their behalf.</div>
      <div style={{ flex: 1 }}>
        <AuthField label="What do you call them?" value={n} onChange={setN} type="text" placeholder="e.g. Mom, or their first name" required
          hint="We'll use this throughout — “How is Mom feeling today?”"/>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary, margin: '4px 0 10px' }}>Your relationship<span style={{ color: C.primary }}> *</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {RELATIONSHIPS.map(r => {
            const on = rel === r.value
            return (
              <button key={r.value} onClick={() => setRel(r.value)} style={{ height: 40, padding: '0 16px', borderRadius: 9999, border: `${on ? 1.5 : 1}px solid ${on ? C.primary : C.border}`, backgroundColor: on ? C.primaryLight : C.bgCard, color: on ? C.primary : C.textPrimary, fontSize: 14.5, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{r.label}</button>
            )
          })}
        </div>
        <div style={{ height: 20 }}/>
        {!dobUnknown ? (
          <>
            <DateInputField label={shown ? `${_cap(_possessive(shown))} date of birth` : 'Date of birth'} value={bd} onChange={setBd} required max={today} yearRange={[thisYear - 110, thisYear]} defaultValue={`${thisYear - 65}-01-01`} hint={null}/>
            <button onClick={() => setDobUnknown(true)} style={{ marginTop: -4, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary, fontFamily: 'Inter,sans-serif' }}>
              {shown ? `I don't know ${_possessive(shown)} birthday` : "I don't know the birthday"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary, margin: '0 0 10px' }}>{shown ? `About how old is ${shown}?` : 'About how old?'}<span style={{ color: C.primary }}> *</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AGE_RANGES.map(a => {
                const on = age === a.value
                return <button key={a.value} onClick={() => setAge(a.value)} style={{ height: 40, padding: '0 16px', borderRadius: 9999, border: `${on ? 1.5 : 1}px solid ${on ? C.primary : C.border}`, backgroundColor: on ? C.primaryLight : C.bgCard, color: on ? C.primary : C.textPrimary, fontSize: 14.5, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{a.label}</button>
              })}
            </div>
            <div style={{ fontSize: 12.5, color: C.textTertiary, lineHeight: 1.5, marginTop: 10 }}>We'll ask for the exact date if you share with the care team.</div>
            <button onClick={() => { setDobUnknown(false); setAge(null) }} style={{ marginTop: 8, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary, fontFamily: 'Inter,sans-serif' }}>I know the date</button>
          </>
        )}
      </div>
      <button onClick={() => valid && onContinue(dobUnknown
          ? { patient_name: n.trim(), relationship: rel, patient_dob: null, patient_age_range: age }
          : { patient_name: n.trim(), relationship: rel, patient_dob: bd, patient_age_range: null })} style={{ ..._onbBtn(true), marginTop: 24, opacity: valid ? 1 : 0.45, cursor: valid ? 'pointer' : 'default' }}>Continue</button>
    </div>
  )
}

// Create account, step 2 — "About you": name + date of birth, then the account is created
// with the credentials from step 1. Back returns to step 1 with those credentials kept.
// Always the account holder's own details. For a caregiver, the patient's name, relationship and
// date of birth were already given on "Who are you caring for?", so this screen says plainly
// that it's theirs ("Now, a little about you" / "This is just for your account").
const OnbAbout = ({ mode = 'create', creds, details, onDetailsChange, onCreated, onContinue, subject }) => {
  const sub = subject || careSubject(null)
  const { firstName = '', lastName = '', birthDate = '' } = details
  const set = (k) => (v) => { onDetailsChange({ ...details, [k]: v }); setError('') }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const today = localDateStr()
  const thisYear = new Date().getFullYear()
  const valid = firstName.trim() && lastName.trim() && birthDate && birthDate <= today
  const create = () => {
    if (!valid || loading) return
    if (mode === 'collect') { onContinue && onContinue(); return }
    setLoading(true)
    setTimeout(() => {
      const r = createOnboardingAccount({ ...creds, firstName, lastName, birthDate })
      setLoading(false)
      if (r.ok) onCreated(r.user)
      else setError(r.error)
    }, 450)
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 24px 36px', overflowY: 'auto' }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.25, marginBottom: 10 }}>{sub.self ? 'A little about you.' : 'Now, a little about you.'}</div>
      <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.6, marginBottom: 26 }}>
        {sub.self ? 'Your name and date of birth keep your health information matched to you.' : `This is just for your account — you've already told us about ${sub.ref}.`}
      </div>
      <div style={{ flex: 1 }}>
        <AuthField label={sub.self ? 'First name' : 'Your first name'} value={firstName} onChange={set('firstName')} type="text" placeholder="First name" required/>
        <AuthField label={sub.self ? 'Last name' : 'Your last name'} value={lastName} onChange={set('lastName')} type="text" placeholder="Last name" required/>
        <DateInputField label={sub.self ? 'Date of birth' : 'Your date of birth'} value={birthDate} onChange={set('birthDate')} required max={today} yearRange={[thisYear - 110, thisYear]} defaultValue={`${thisYear - 50}-01-01`} hint={null}/>
        {error && <div style={{ fontSize: 13, color: '#ef4444', margin: '4px 0 16px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: 8 }}>{error}</div>}
      </div>
      <button onClick={create} style={{ ..._onbBtn(true), opacity: valid ? 1 : 0.45, cursor: valid ? 'pointer' : 'default' }}>{mode === 'collect' ? 'Continue' : loading ? 'Creating account…' : 'Create account'}</button>
    </div>
  )
}

// Matched community (silent auto-join), from the answers.
const _matchCommunity = (ans) => {
  const MAP = {
    RCC: { default: 'rcc-general', clear_cell: 'rcc-clear-cell', stage_4: 'rcc-stage-iv' },
  }
  const m = MAP[ans.cancer_type] || { default: 'newly-diagnosed' }
  const id = stageFromAnswers(ans) === 'IV' && m.stage_4 ? m.stage_4
    : ans.histology === 'clear_cell' && m.clear_cell ? m.clear_cell
    : m.default
  return COMMUNITIES.flatMap(s => s.items).find(c => c.id === id) || null
}

// Record info (who the patient is) comes right after "who's this for"; the account step is
// only about the account. Self: the patient IS the user, so one "About you" covers both, then
// sign-in creates the account. Caregiver: the patient's details, then sign-in, then the
// caregiver's own details create the account.
const onbSteps = (ans) => ['cancer_type', 'extent', 'treatment_phase', 'role',
  ...(ans.role === 'caregiver' ? ['patient', 'account', 'about'] : ['about', 'account'])]

const OnboardingScreen = ({ onComplete, onExit }) => {
  const [step, setStep] = useState('cancer_type')
  const [dir, setDir] = useState(1)
  const [stepKey, setStepKey] = useState(0)
  const [answers, setAnswers] = useState({})   // pre-registration cache — written to the record on account creation
  const [creds, setCreds] = useState(null)     // sign-in method chosen on 'account', used on 'about'
  const [details, setDetails] = useState({})   // name + date of birth, kept if the person steps back
  const [accountError, setAccountError] = useState('')
  const isCaregiver = answers.role === 'caregiver'
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])

  const go = (next, d = 1) => { setDir(d); setStepKey(k => k + 1); setStep(next) }
  // Steps depend on the answers (caregivers get the 'patient' step), so advancing reads the
  // step list for the answers as they'll be after this one.
  const steps = onbSteps(answers)
  const idx = steps.indexOf(step)
  const forward = (ans = answers) => { const st = onbSteps(ans); go(st[st.indexOf(step) + 1], 1) }
  const back = () => { if (idx === 0) { setVis(false); setTimeout(() => onExit && onExit(), 300); return } go(steps[idx - 1], -1) }
  const answer = (key, value) => { const next = { ...answers, [key]: value }; setAnswers(next); forward(next) }

  const finish = (user) => {
    const ans = { ...answers, role: answers.role || 'self' }
    // The record's date of birth is the patient's: the account holder's own for self,
    // the one given on "Who are you caring for?" for a caregiver.
    const recordDob = ans.role === 'caregiver' ? (ans.patient_dob || null) : (user.birthDate || null)
    setVis(false)
    setTimeout(() => {
      onComplete({
        ...buildPatientStateFromAnswers(ans, { onboardedDate: localDateStr(), dateOfBirth: recordDob }),
        user,
        onboardingMedications: [],
        matchedCommunity: _matchCommunity(ans),
      })
    }, 380)
  }

  const progress = (idx + 1) / steps.length
  const showProgress = true
  // Self: choosing a sign-in method creates the account with the "About you" details already given.
  const onAccountChosen = (c) => {
    setCreds(c); setAccountError('')
    if (isCaregiver) { forward(); return }
    const r = createOnboardingAccount({ ...c, ...details })
    if (r.ok) finish(r.user)
    else setAccountError(r.error)
  }

  let body
  if (step === 'cancer_type') body = <OnbCancerType showNote value={answers.cancer_type} onPick={v => answer('cancer_type', v)}/>
  // Required one-tap choice (no Skip): it decides whose record this is, whose name the copy
  // uses, and whose date of birth goes on the record.
  else if (step === 'role') body = <OnbQuestion {...ONB_QUESTIONS.role} value={answers.role} onPick={v => answer('role', v)}/>
  else if (step === 'patient') body = <OnbPatient name={answers.patient_name} relationship={answers.relationship} dob={answers.patient_dob} ageRange={answers.patient_age_range} onContinue={p => { const next = { ...answers, ...p }; setAnswers(next); forward(next) }}/>
  else if (step === 'account') body = <OnbAccount creds={creds} error={accountError} onContinue={onAccountChosen}/>
  else if (step === 'about') body = isCaregiver
    ? <OnbAbout mode="create" creds={creds} details={details} onDetailsChange={setDetails} onCreated={finish} subject={careSubject({ role: answers.role, relationship: answers.relationship, patientName: answers.patient_name })}/>
    : <OnbAbout mode="collect" details={details} onDetailsChange={setDetails} onContinue={() => forward()} subject={careSubject(null)}/>
  else { const q = ONB_QUESTIONS[step]; body = <OnbQuestion {...q} value={answers[q.key]} onPick={v => answer(q.key, v)}/> }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, backgroundColor: C.bgCard, display: 'flex', flexDirection: 'column', opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.36s ease, transform 0.36s ease', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ position: 'relative', flexShrink: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 8px 0 4px' }}>
          <button onClick={back} aria-label="Back" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <Ico.back/>
          </button>
        </div>
        {showProgress && (
          <div style={{ position: 'absolute', bottom: 0, left: 24, right: 24, height: 4, borderRadius: 2, backgroundColor: C.bgApp, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, backgroundColor: C.primary, width: `${progress * 100}%`, transition: 'width 0.3s ease' }}/>
          </div>
        )}
      </div>
      <div key={stepKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: `stepEnter${dir > 0 ? 'Fwd' : 'Bwd'} 0.22s ease-out forwards` }}>
        {body}
      </div>
    </div>
  )
}

// One-tap gap answering — the anti-maze. Opens exactly one question, in context, with a
// reason; saving closes the gap everywhere (gaps are derived from the answers).
// `questions` may be one key or a short sequence (the diagnosis card's Edit uses one).
const AnswerQuestionSheet = ({ questions, answers = {}, onSave, onClose }) => {
  const keys = Array.isArray(questions) ? questions : [questions]
  const [local, setLocal] = useState({ ...answers })
  return (
    <FlowShell onClose={onClose} zIndex={300}>
      {(dismiss, setNav) => {
        const [i, setI] = useState(0)
        useEffect(() => { setNav({ title: keys.length > 1 ? 'Clinical details' : '', subtitle: null, onBack: i > 0 ? () => setI(n => n - 1) : null }) }, [i])
        const k = keys[i]
        const pick = (v) => {
          const next = { ...local, [k]: v }
          setLocal(next)
          if (i < keys.length - 1) setI(n => n + 1)
          else onSave(next)
        }
        return (
          <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'stepEnterFwd 0.22s ease-out forwards' }}>
            {k === 'cancer_type'
              ? <OnbCancerType value={local.cancer_type} onPick={pick}/>
              : <OnbQuestion {...ONB_QUESTIONS[k]} value={local[k]} onPick={pick}/>}
          </div>
        )
      }}
    </FlowShell>
  )
}



// ─── POST DETAIL VIEW ────────────────────────────────────────────
const PostDetailView = ({ post, community, onClose }) => {
  const [vis, setVis] = useState(false)
  const [commentText, setCommentText] = useState('')
  const comments = POST_COMMENTS[post.id] || []

  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 320) }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      transform: vis ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
      display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', height: 44, borderBottom: `1px solid ${C.border}`, flexShrink: 0, gap: 10 }}>
        <button onClick={dismiss} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <Ico.back/>
        </button>
        {/* Author avatar */}
        <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: post.author.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{post.author.initials}</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.author.name}</div>
          <div style={{ fontSize: 11, color: C.textTertiary }}>{post.timeAgo} · {community.name}</div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {/* Post body */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 15, color: C.textPrimary, lineHeight: 1.7, margin: 0 }}>{post.body}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 14 }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>favorite</span>
              <span style={{ fontSize: 13, color: C.textTertiary }}>{post.likes}</span>
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chat_bubble</span>
              <span style={{ fontSize: 13, color: C.textTertiary }}>{post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>
            </button>
          </div>
        </div>

        {/* Comments */}
        {comments.map(comment => (
          <div key={comment.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              {comment.isAI ? (
                <div style={{ width: 38, height: 38, borderRadius: 19, background: `linear-gradient(135deg, ${C.primary} 0%, #ff5b3a 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>auto_awesome</span>
                </div>
              ) : (
                <div style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: comment.author.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{comment.author.initials}</span>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: comment.isAI ? C.primary : C.textPrimary }}>
                    {comment.isAI ? 'Community AI Agent' : comment.author.name}
                  </span>
                  <span style={{ fontSize: 11, color: C.textTertiary }}>{comment.timeAgo}</span>
                </div>
                <p style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.65, margin: 0 }}>{comment.body}</p>
              </div>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: C.textTertiary }}>No comments yet. Be the first to reply.</div>
          </div>
        )}
      </div>

      {/* Comment input */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, borderTop: `1px solid ${C.border}`, padding: '10px 16px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
          placeholder="Add a comment"
          style={{ flex: 1, height: 40, borderRadius: 20, border: `1px solid ${C.border}`, padding: '0 16px', fontSize: 14, color: C.textPrimary, backgroundColor: C.bgApp, outline: 'none', fontFamily: 'Inter, sans-serif' }}
        />
        <button style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: commentText ? C.primary : C.bgApp, border: 'none', cursor: commentText ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: commentText ? 'white' : C.textTertiary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>send</span>
        </button>
      </div>
    </div>
  )
}


// ─── COMMUNITY DETAIL VIEW ───────────────────────────────────────
const CommunityDetailView = ({ community, onClose }) => {
  const [vis, setVis] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [titleOpacity, setTitleOpacity] = useState(0)
  const scrollRef = useRef(null)
  const bannerTitleRef = useRef(null)
  const posts = COMMUNITY_POSTS[community.id] || []

  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 320) }

  // Track banner title scrolling past header — fade community name into header
  const handleScroll = () => {
    const container = scrollRef.current
    const titleEl = bannerTitleRef.current
    if (!container || !titleEl) return
    const containerTop = container.getBoundingClientRect().top
    const titleBottom = titleEl.getBoundingClientRect().bottom
    // When title bottom crosses the header bottom (containerTop + 60), start fading in
    const threshold = containerTop + 60
    const fadeRange = 24
    const diff = threshold - titleBottom
    const opacity = Math.max(0, Math.min(1, diff / fadeRange))
    setTitleOpacity(opacity)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 75,
      transform: vis ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
      display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard,
    }}>


      {/* Shared app header — back button left, community name fades in on scroll */}
      <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 8px 0 4px', backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, flexShrink: 0, position: 'relative' }}>
        <button onClick={dismiss} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <Ico.back/>
        </button>
        {/* Title fades in as banner scrolls past */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, opacity: titleOpacity, transition: 'opacity 0.1s linear' }}>
            {community.name}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {/* Banner */}
        <div style={{ height: 140, background: `linear-gradient(135deg, ${community.color}dd 0%, ${community.color}88 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>{community.initials}</span>
          </div>
        </div>

        {/* Community info — name here is the source of truth that scrolls away */}
        <div style={{ padding: '16px 16px 0' }}>
          <div ref={bannerTitleRef} style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, marginBottom: 6 }}>{community.name}</div>
          <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>{community.description}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: C.textTertiary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>group</span>
            <span style={{ fontSize: 13, color: C.textTertiary }}>{community.memberCount.toLocaleString()} members</span>
          </div>
          <div style={{ height: 1, backgroundColor: C.border }}/>
        </div>

        {/* Posts feed */}
        {posts.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: C.textTertiary }}>No posts yet in this community.</div>
          </div>
        ) : (
          posts.map(post => (
            <button key={post.id} onClick={() => setSelectedPost(post)}
              style={{ width: '100%', padding: '14px 16px', backgroundColor: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: post.author.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{post.author.initials}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{post.author.name}</div>
                    <div style={{ fontSize: 11, color: C.textTertiary }}>{post.timeAgo}</div>
                  </div>
                </div>
                <span style={{ fontSize: 18, color: C.textTertiary, fontWeight: 700, lineHeight: 1 }}>···</span>
              </div>
              <p style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.65, margin: '0 0 10px', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}>{post.body}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>favorite</span>
                  <span style={{ fontSize: 12, color: C.textTertiary }}>{post.likes}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chat_bubble</span>
                  <span style={{ fontSize: 12, color: C.textTertiary }}>{post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Start a conversation FAB */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', backgroundColor: C.bgCard, borderTop: `1px solid ${C.border}` }}>
        <button style={{ width: '100%', height: 50, borderRadius: 25, backgroundColor: C.textPrimary, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>edit</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Start a conversation</span>
        </button>
      </div>

      {selectedPost && (
        <PostDetailView post={selectedPost} community={community} onClose={() => setSelectedPost(null)}/>
      )}
    </div>
  )
}

// ─── BOTTOM NAV ──────────────────────────────────────────────────
const NAV_TABS = [
  { id: 'careplan',  label: 'Today',      icon: 'today' },
  { id: 'plan',      label: 'Care plan',  icon: 'route' },
  { id: 'track',     label: 'Tracker',    icon: 'monitor_heart' },
  { id: 'community', label: 'Community',  icon: 'group' },
  { id: 'resources', label: 'Resources',  icon: 'menu_book', flag: 'resourcesTab' },
]

// Liquid-glass footer: a floating rounded capsule (translucent + blur, specular
// inset highlight) with a lens-style active tab. The parent positions it absolutely
// over the content; scroll regions reserve bottom clearance (paddingBottom ~96–110).
const BottomNav = ({ activeTab, onTabChange }) => (
  <div style={{ flexShrink: 0, padding: '6px 12px calc(10px + env(safe-area-inset-bottom, 0px))', backgroundColor: 'transparent' }}>
    <div style={{
      display: 'flex', height: 60, borderRadius: 30, padding: '0 6px',
      backgroundColor: 'rgba(252,250,249,0.68)',
      backdropFilter: 'blur(24px) saturate(185%)', WebkitBackdropFilter: 'blur(24px) saturate(185%)',
      border: '1px solid rgba(255,255,255,0.55)',
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.65), 0 8px 26px rgba(0,0,0,0.12)',
    }}>
      {NAV_TABS.filter(tab => !tab.flag || exp(tab.flag) === 'on').map(tab => {
        const active = activeTab === tab.id
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2, border: 'none',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            margin: '6px 3px', borderRadius: 20,
            backgroundColor: active ? 'rgba(255,255,255,0.72)' : 'transparent',
            boxShadow: active ? 'inset 0 1px 1px rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.08)' : 'none',
            transition: 'background-color 0.18s, box-shadow 0.18s',
            fontFamily: 'Inter,sans-serif',
          }}>
            <span className="material-symbols-rounded" style={{
              fontSize: 23, color: active ? C.primary : C.textTertiary,
              fontVariationSettings: `'FILL' ${active ? 1 : 0}, 'wght' 400`,
              transition: 'color 0.15s',
            }}>{tab.icon}</span>
            <span style={{
              fontSize: 9.5, fontWeight: active ? 600 : 500,
              color: active ? C.primary : C.textTertiary,
              transition: 'color 0.15s', letterSpacing: '0.01em',
            }}>{tab.label}</span>
          </button>
        )
      })}
    </div>
  </div>
)

// ─── PLACEHOLDER SCREENS ─────────────────────────────────────────
// Resources tab (feature-flagged, resourcesTab) — placeholder for now.
const ResourcesScreen = () => (
  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgApp, padding: '0 40px', textAlign: 'center' }}>
    <div style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
      <span className="material-symbols-rounded" style={{ fontSize: 34, color: C.textIcon, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>menu_book</span>
    </div>
    <div style={{ fontSize: 19, fontWeight: 700, color: C.textPrimary, marginBottom: 6, letterSpacing: '-0.3px' }}>Resources</div>
    <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5 }}>Curated cancer guidance, articles, and support — coming soon.</div>
  </div>
)


// ─── SEGMENTED CONTROL ───────────────────────────────────────────
const SegmentedControl = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', padding: '10px 16px 0', backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
    <div style={{ display: 'flex', flex: 1, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 3, gap: 2 }}>
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            backgroundColor: isActive ? C.bgCard : 'transparent',
            fontSize: 13, fontWeight: isActive ? 600 : 500,
            color: isActive ? C.textPrimary : C.textSecondary,
            boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            transition: 'background 0.18s, color 0.18s, box-shadow 0.18s',
            whiteSpace: 'nowrap',
          }}>
            {tab.label}
          </button>
        )
      })}
    </div>
  </div>
)

// ─── MEDICATION INFO VIEW ─────────────────────────────────────────
// Slides in from right — z:72 — shows drug info from catalog + Add CTA
const MedicationInfoView = ({ item, onClose, onAdd }) => {
  const [vis, setVis] = useState(false)
  const [dockShadow, setDockShadow] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 320) }
  const handleAdd = () => { dismiss(); setTimeout(() => onAdd(item), 320) }
  const handleScroll = (e) => setDockShadow(e.target.scrollHeight - e.target.scrollTop > e.target.clientHeight + 2)

  // Mock drug info keyed to well-known medications for the prototype
  const drugInfo = {
    pronunciation: item.searchTerms?.[0] ? null : null,
    brandNames: item.subtitle ? [item.name] : [],
    overview: `${item.name} is used in the treatment of ${item.subtitle || 'cancer'}. Always follow your care team's instructions regarding dosage and administration.`,
    warnings: 'Talk to your doctor about all medications you are taking, including over-the-counter drugs and supplements. Do not start, stop, or change the dose of any drug without checking with your doctor.',
    sideEffects: 'Side effects vary by individual. Report any unusual symptoms to your care team promptly.',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 72,
      transform: vis ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
      display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 8px 0 4px', backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={dismiss} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Ico.back/>
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: C.textPrimary, padding: '0 40px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 6 }}>{item.name}</div>
          {item.subtitle && <div style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>{item.subtitle}</div>}
          <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, marginBottom: 0 }}>{drugInfo.overview}</p>
        </div>

        {item.searchTerms?.length > 1 && (
          <div style={{ padding: '24px 20px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Also known as</div>
            <div style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '13px 15px' }}>
              <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.6 }}>
                {item.searchTerms.slice(0, 6).join(', ')}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Warning and Uses</div>
          <div style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '13px 15px' }}>
            <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.65 }}>{drugInfo.warnings}</div>
          </div>
        </div>

        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Side Effects</div>
          <div style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '13px 15px' }}>
            <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.65 }}>{drugInfo.sideEffects}</div>
          </div>
        </div>

        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 11, color: C.textTertiary, lineHeight: 1.6 }}>
            This information is for educational purposes only and does not replace advice from your care team.
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, padding: '12px 20px 34px', boxShadow: dockShadow ? '0 -4px 12px rgba(0,0,0,0.08)' : 'none', transition: 'box-shadow 0.2s' }}>
        <button onClick={handleAdd} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white' }}>
          Add
        </button>
      </div>
    </div>
  )
}

// ─── MEDICATION ADD FLOW ──────────────────────────────────────────
// Full-screen push overlay — z:73 — 4 steps: Dosage → Food → Notes → Review → Save
// ─── TRACKER MEDICATION FLOW ─────────────────────────────────────
// Tracker-specific flow. Step 0 is always MedicationSearchSheet (shared).
// After selection continues to tracker-specific steps: Info → Dosage → Food → Notes → Review.
const TrackerMedicationFlow = ({ onClose, onSave, patientState }) => {
  const [selectedItem, setSelectedItem] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [showSteps, setShowSteps] = useState(false)

  // Phase 1: MedicationSearchSheet slides up
  if (!selectedItem) {
    return (
      <MedicationSearchSheet
        onClose={onClose}
        onSelect={item => setSelectedItem(item)}
        diagnosisCode={patientState?.diagnosisCode || ''}
      />
    )
  }

  // Phase 2: MedicationInfoView pushes in from right
  if (!showSteps) {
    return (
      <MedicationInfoView
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAdd={() => setShowSteps(true)}
      />
    )
  }

  // Phase 3: Tracker-specific add steps (dosage → food → notes → review)
  return (
    <TrackerAddSteps
      item={selectedItem}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

// ─── TRACKER ADD STEPS ────────────────────────────────────────────
// The tracker-unique portion: dosage → food instructions → notes → review → save.
// Extracted so TrackerMedicationFlow stays readable.
const TrackerAddSteps = ({ item, onClose, onSave }) => {
  const [vis, setVis] = useState(false)
  const [step, setStep] = useState(0) // 0=dosage 1=food 2=notes 3=review
  const [stepDir, setStepDir] = useState(1)
  const [stepKey, setStepKey] = useState(0)
  const [dosage, setDosage] = useState('')
  const [foodInstruction, setFoodInstruction] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 320) }

  const stepTo = (n, dir = 1) => { setStepDir(dir); setStepKey(k => k + 1); setStep(n) }
  const progress = (step + 1) / 4

  const foodOptions = [
    { value: 'before', label: 'Take before food' },
    { value: 'with',   label: 'Take with food' },
    { value: 'after',  label: 'Take after food' },
    { value: 'none',   label: 'None' },
  ]

  const foodLabel = foodInstruction ? foodOptions.find(o => o.value === foodInstruction)?.label : null

  const handleSave = () => {
    setSaving(true)
    const record = {
      id: `med-tracker-${Date.now()}`,
      name: item.name,
      genericName: item.subtitle || '',
      dosage: dosage.trim() || null,
      foodInstruction,
      notes: notes.trim() || null,
      startDate: null,
      endDate: null,
      isCurrentlyTaking: true,
      addedAt: new Date().toISOString(),
    }
    setTimeout(() => { setSaving(false); dismiss(); setTimeout(() => onSave(record), 320) }, 600)
  }

  const STEPS = [
    // Step 0: Dosage
    (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 20px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.2 }}>
          What is your daily dose?
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <label style={{ position: 'absolute', left: 14, top: dosage ? -8 : 15, fontSize: dosage ? 11 : 15, color: dosage ? C.primary : C.textTertiary, transition: 'all 0.15s', backgroundColor: C.bgCard, padding: '0 4px', pointerEvents: 'none', fontWeight: 500 }}>
            Add dosage (optional)
          </label>
          <input
            type="text" value={dosage} onChange={e => setDosage(e.target.value)}
            style={{ width: '100%', height: 52, border: `1.5px solid ${dosage ? C.primary : C.border}`, borderRadius: 12, padding: '0 14px', fontSize: 15, color: C.textPrimary, backgroundColor: C.bgCard, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1 }}/>
        <button onClick={() => stepTo(1)} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white' }}>
          Next
        </button>
      </div>
    ),
    // Step 1: Food instructions
    (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 20px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, marginBottom: 28, lineHeight: 1.2 }}>
          What food instructions are there?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {foodOptions.map(opt => (
            <button key={opt.value} onClick={() => setFoodInstruction(opt.value)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: foodInstruction === opt.value ? C.primaryLight : C.bgCard, border: `1.5px solid ${foodInstruction === opt.value ? C.primary : C.border}`, borderRadius: 13, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s, border-color 0.15s', width: '100%' }}>
              <span style={{ fontSize: 15, fontWeight: foodInstruction === opt.value ? 600 : 500, color: foodInstruction === opt.value ? C.primary : C.textPrimary, transition: 'color 0.15s' }}>{opt.label}</span>
              <Ico.chevRight/>
            </button>
          ))}
        </div>
        <button onClick={() => stepTo(2)} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white', marginTop: 20 }}>
          Next
        </button>
      </div>
    ),
    // Step 2: Notes
    (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 20px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, marginBottom: 24, lineHeight: 1.2 }}>
          Optional details
        </div>
        <div style={{ position: 'relative', flex: 1, marginBottom: 20 }}>
          <label style={{ position: 'absolute', left: 14, top: notes ? -8 : 16, fontSize: notes ? 11 : 15, color: notes ? C.primary : C.textTertiary, transition: 'all 0.15s', backgroundColor: C.bgCard, padding: '0 4px', pointerEvents: 'none', fontWeight: 500 }}>
            Add notes
          </label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ width: '100%', height: 120, border: `1.5px solid ${notes ? C.primary : C.border}`, borderRadius: 12, padding: '14px', fontSize: 15, color: C.textPrimary, backgroundColor: C.bgCard, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', resize: 'none', lineHeight: 1.6 }}
          />
        </div>
        <button onClick={() => stepTo(3)} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white' }}>
          Next
        </button>
      </div>
    ),
    // Step 3: Review
    (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '88px 20px 110px', overflowY: 'auto' }}>
        <div style={{ flex: 1 }}>
          {[
            { icon: 'diamond', label: 'Dosage', value: dosage || 'Not specified' },
            { icon: 'restaurant', label: 'Food instruction', value: foodLabel || 'Not specified' },
            { icon: 'calendar_today', label: 'Duration', value: 'Add start and end dates' },
            { icon: 'notes', label: 'Notes', value: notes || 'No notes' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
              <span className="material-symbols-rounded" style={{ fontSize: 22, color: C.primary, fontVariationSettings: "'FILL' 1, 'wght' 400", flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{row.label}</div>
                <div style={{ fontSize: 14, color: row.value.includes('Not') || row.value === 'No notes' || row.value.includes('Add') ? C.textTertiary : C.textSecondary }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: saving ? '#e0e0e0' : C.primary, border: 'none', cursor: saving ? 'default' : 'pointer', fontSize: 16, fontWeight: 600, color: saving ? '#aaa' : 'white', marginTop: 24 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    ),
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 73,
      transform: vis ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
      display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* Shared header with progress bar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 8px 0 4px', backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}` }}>
          <button onClick={step > 0 ? () => stepTo(step - 1, -1) : dismiss} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <Ico.back/>
          </button>
          <div style={{ flex: 1, textAlign: 'center', pointerEvents: 'none', overflow: 'hidden', padding: '0 4px' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          </div>
          <button onClick={dismiss} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <Ico.close/>
          </button>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: C.border }}>
          <div style={{ height: '100%', backgroundColor: '#22c55e', width: `${progress * 100}%`, transition: 'width 0.3s ease' }}/>
        </div>
      </div>
      {/* Step content with directional slide */}
      <div key={stepKey} style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: `stepEnter${stepDir > 0 ? 'Fwd' : 'Bwd'} 0.22s ease-out forwards`,
      }}>
        {STEPS[step]}
      </div>
    </div>
  )
}

// ─── MEDICATION CARD ──────────────────────────────────────────────
const MedicationCard = ({ medication }) => (
  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.bgCard }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{railIcon('medication', 36)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{medication.name}</div>
        {medication.foodInstruction && (
          <div style={{ fontSize: 13, color: C.textSecondary }}>
            {medication.foodInstruction === 'before' ? 'Take before food' : medication.foodInstruction === 'with' ? 'Take with food' : medication.foodInstruction === 'after' ? 'Take after food' : null}
          </div>
        )}
        {medication.dosage && <div style={{ fontSize: 13, color: C.textSecondary }}>{medication.dosage}</div>}
      </div>
    </div>
  </div>
)

// ─── MEDICATIONS TAB ──────────────────────────────────────────────
const MedicationsTab = ({ medications, patientState, onAddTapped, medInfoView, setMedInfoView, onSaveMedication }) => {
  // Filter catalog by diagnosisCode for "frequently added" section
  const catalog = getMedicationCatalog()
  const diagCode = patientState?.diagnosisCode || ''
  const suggested = catalog.filter(m => {
    const sub = (m.subtitle || '').toLowerCase()
    if (diagCode === 'RCC') return sub.includes('kidney') || sub.includes('rcc')
    if (diagCode === 'CRC') return sub.includes('crc') || sub.includes('colorectal') || sub.includes('colon')
    if (diagCode === 'BREAST') return sub.includes('breast')
    return false
  }).slice(0, 8)

  const isEmpty = medications.length === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingTop: 60, paddingBottom: 100, position: 'relative', backgroundColor: C.bgCard }}>
      {isEmpty ? (
        // ── Empty state ─────────────────────────────────────────
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 38, color: C.textIcon, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>medication</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px' }}>Track your medications</div>
          <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, maxWidth: 260 }}>
            Log and understand your cancer medications. Keep track of dosages and food instructions.
          </div>
          <button onClick={onAddTapped} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, height: 50, paddingLeft: 24, paddingRight: 24, borderRadius: 25, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'white' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>add</span>
            Add medication
          </button>
        </div>
      ) : (
        // ── Populated state ─────────────────────────────────────
        <div style={{ paddingBottom: 80 }}>
          <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, marginBottom: 2 }}>Current Medications</div>
              <div style={{ fontSize: 13, color: C.textSecondary }}>A full list of current medications</div>
            </div>
          </div>
          {medications.map(med => <MedicationCard key={med.id} medication={med}/>)}
        </div>
      )}

      {/* + Medication FAB */}
      {!isEmpty && (
        <button onClick={onAddTapped} style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8, height: 52, paddingLeft: 20, paddingRight: 24, borderRadius: 26, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>add</span>
          Medication
        </button>
      )}

      {/* Medication search — reuses care plan AddMedicationFlow (FlowShell slides up) */}
      {medInfoView?.type === 'search' && (
        <TrackerMedicationFlow
          onClose={() => setMedInfoView(null)}
          onSave={onSaveMedication}
          patientState={patientState}
        />
      )}


    </div>
  )
}

// ─── SYMPTOMS TAB ─────────────────────────────────────────────────
const SymptomsTab = () => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', gap: 16, backgroundColor: C.bgCard }}>
    <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="material-symbols-rounded" style={{ fontSize: 38, color: '#6366f1', fontVariationSettings: "'FILL' 0, 'wght' 300" }}>vital_signs</span>
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px' }}>Symptom tracking</div>
    <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, maxWidth: 260 }}>
      Track and understand your symptoms over time. Coming soon.
    </div>
  </div>
)

// ─── TRACK SCREEN ─────────────────────────────────────────────────
const TrackScreen = ({ medications, patientState, onSaveMedication, symptoms = [], journal = [], onOpenSymptomFlow, onOpenJournalFlow, onOpenDoseLog }) => {
  const [trackTab, setTrackTab] = useState('medications')
  const [medInfoView, setMedInfoView] = useState(null)

  const openSearch = () => {
    setMedInfoView({ type: 'search' })
  }

  const TRACK_TABS = [
    { id: 'medications', label: 'Medications' },
    { id: 'symptoms',    label: 'Symptoms' },
    { id: 'journal',     label: 'Journal' },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: C.bgCard, paddingTop: 60 }}>
      <SegmentedControl tabs={TRACK_TABS} active={trackTab} onChange={setTrackTab}/>
      {trackTab === 'medications' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {medications.length > 0 && (
            <div style={{ padding: '10px 16px 0' }}>
              <button onClick={onOpenDoseLog} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', backgroundColor: C.bgApp, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.primary }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.primary }}>add_task</span>Log a dose
              </button>
            </div>
          )}
          <MedicationsTab
            medications={medications}
            patientState={patientState}
            onAddTapped={openSearch}
            medInfoView={medInfoView}
            setMedInfoView={setMedInfoView}
            onSaveMedication={onSaveMedication}
          />
        </div>
      )}
      {trackTab === 'symptoms' && <SymptomsPanel symptoms={symptoms} onAdd={onOpenSymptomFlow}/>}
      {trackTab === 'journal' && <JournalPanel journal={journal} onAdd={onOpenJournalFlow}/>}
    </div>
  )
}

const HomeScreen = () => (
  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 12, backgroundColor: C.bgCard }}>
    <span className="material-symbols-rounded" style={{ fontSize: 44, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>home</span>
    <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Home</div>
    <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 1.65, maxWidth: 260 }}>Your daily overview, upcoming events, and tasks will appear here.</div>
  </div>
)

const CommunityScreen = ({ onSelectCommunity, autoJoinedId }) => (
  <div style={{ flex: 1, overflowY: 'auto', backgroundColor: C.bgCard, paddingTop: 60 }}>
    {COMMUNITIES.map(section => (
      <div key={section.category}>
        <div style={{ padding: '16px 16px 8px', fontSize: 13, fontWeight: 600, color: C.textSecondary }}>
          {section.category}
        </div>
        <div style={{ height: 1, backgroundColor: C.border, margin: '0 0 4px' }}/>
        {section.items.map(community => {
          const isJoined = community.id === autoJoinedId
          return (
            <button key={community.id} onClick={() => onSelectCommunity(community)}
              style={{ width: '100%', padding: '14px 16px', backgroundColor: isJoined ? C.primaryLight : 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: community.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>{community.initials}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{community.name}</div>
                  {isJoined && <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, backgroundColor: 'rgba(255,121,88,0.12)', borderRadius: 9999, padding: '2px 8px' }}>Joined</div>}
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', marginBottom: 4 }}>{community.description}</div>
                <div style={{ fontSize: 12, color: C.textTertiary }}>{community.memberCount.toLocaleString()} members</div>
              </div>
            </button>
          )
        })}
      </div>
    ))}
    <div style={{ height: 20 }}/>
  </div>
)


// ─── CHAT (AI assistant) ──────────────────────────────────────────
// P0 vertical slice. The "LLM" is simulated: routeChat() is a rule engine
// keyed off the question map (chat-question-map-v1.md). It returns a response
// payload plus which components to attach. Distress/capture are P1 — not here.

const CHAT_CANCER = { RCC: 'kidney cancer', BREAST: 'breast cancer', CRC: 'colorectal cancer', PROSTATE: 'prostate cancer', LUNG: 'lung cancer' }

// Session message limit (combined patient + AI, incl. any loaded prior transcript) — PRD §11.
// TEST VALUES (8/10) for easy triggering; production is 180 soft / 200 hard.
const MSG_SOFT_LIMIT = 8
const MSG_HARD_LIMIT = 10

// Type-accurate acknowledgment posted back into chat after a capture saves.
const buildCaptureAck = (type, event) => {
  const name = (event && event.name) || 'that'
  if (type === 'medication') return `${name} is saved — it'll show in your medication tracker and on your timeline, and I'll take it into account here in chat.`
  if (type === 'appointment') return `Added — ${name} will show on your timeline.`
  if (type === 'symptom') return `Saved — it'll show in your symptom tracker.`
  return `Saved to your record.`
}

const shortProvider = (name) => {
  if (!name) return 'your care team'
  const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/)
  return 'Dr. ' + (parts[parts.length - 1] || name)
}

const chatRelDate = (dateStr) => {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const d = new Date(dateStr + 'T12:00:00')
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff > 1 && diff <= 6) return 'next ' + d.toLocaleDateString('en-US', { weekday: 'long' })
  return 'on ' + d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// The simulated router. Order matters: hard-stops (safety) before answers.
const routeChat = (raw, ctx) => {
  const t = (raw || '').toLowerCase()
  const prov = shortProvider(ctx.providerName)
  const has = (re) => re.test(t)

  // ── SAFETY OVERRIDE (evaluated first) — supersedes ALL routing (CHAT-13) ──
  // Medical emergency
  if (has(/can'?t breathe|chest pain|crushing (chest )?pain|having a (heart attack|stroke)|face (is )?drooping|slurred speech|passing out|about to pass out|severe bleeding|bleeding (a lot|that won'?t stop)|took too many pills|overdose/)) {
    return { kind:'crisis', tier:'emergency',
      text:`This could be a medical emergency. Please call 911 or your local emergency number right now. Getting help quickly matters, and this is beyond what I can do here.`,
      resources:[{ name:'Emergency services', icon:'health_and_safety', iconColor:'#B00020', sub:'For immediate medical emergencies', rows:[[{ label:'Call 911', kind:'primary', does:'call 911' }]], foot:'If you’re outside the US, call your local emergency number.' }] }
  }
  // Emotional crisis (self-harm risk)
  if (has(/(don'?t|do not) want to (be here|live|wake up)|want to die|wish i (were|was) dead|kill (myself|my self)|end (it all|my life|things)|take my (own )?life|hurt(ing)? myself|harm(ing)? myself|self.?harm|suicid|no reason to (live|go on)|can'?t go on|nothing to live for|better off (dead|without me)/)) {
    return { kind:'crisis', tier:'crisis',
      text:`I'm glad you told me. You don't have to face this alone. Call or text 988, or text HOME to 741741, to connect with a trained crisis counselor for free, 24/7 support. If you're in immediate danger, call 911.`,
      resources:[
        { name:'Crisis support', icon:'volunteer_activism', iconColor:'#26A699', sub:'Talk with a trained crisis counselor by phone or text.', rows:[[{ label:'Call 988', kind:'primary', does:'call 988' }, { label:'Text 988', kind:'secondary', does:'text 988' }], [{ label:'Text HOME to 741741', kind:'secondary', does:'text HOME to 741741' }]], foot:'Free crisis support, available 24/7. Standard message and data rates may apply.' },
      ] }
  }

  // ── HARD-STOPS (safety) — evaluated first ──
  if (has(/recur|come ?back|coming back|spread|surviv|prognos|my odds|life expectanc|how long (do|have) i|going to die|will i die|am i going to be (ok|okay|alright)|be cured|is it terminal/)) {
    return { kind:'hardstop', cluster:'prognosis', nurse:true, text:`Wondering whether it might come back is one of the most common things people carry, especially during surveillance — it makes complete sense that it's on your mind.\n\nHere I have to be straight with you: I can't predict what will happen for any one person, and honestly no tool should. What I can tell you is that your scan schedule is built to catch any change early, and for ${ctx.stageLabel} ${ctx.cancerName} it follows NCCN surveillance guidelines.\n\nFor what your own history means for your outlook, ${prov} has your full picture, or you can send your question to our clinical team.` }
  }
  if (has(/should i (stop|start|switch|change|lower|quit|pause|come off|do|take|choose|go on|be on)|stop (taking|my)|come off|change my (dose|treatment|medication|meds)|reduce my dose|skip (a|my) (dose|treatment)|which (treatment|option|drug|med)\b.*(should i|for me|is best|better)|do i qualify|keynote|am i eligible|eligible for|adjuvant.*or.*surveillance/)) {
    return { kind:'hardstop', cluster:'treatment', nurse:true, text:`That's a real decision, and it's yours to make with the people who know your case — I don't want to nudge you one way or the other on something this important.\n\nIf side effects are what's behind the question, that's worth raising sooner rather than later — dose changes or a short break are things your team weighs all the time, and they'd rather hear from you early.\n\nI can explain generally what a treatment is for and the side effects on its label, but whether it's right for you is a conversation for ${prov}, or you can send your question to our clinical team.` }
  }
  if (has(/what does my (scan|path|result|report|lab|blood)|my (scan|pathology|results?|labs?|egfr|bloodwork)\b.*(mean|show|say|look)|is my (egfr|scan|result|lab|number|reading|count)\b.*(normal|okay|ok|bad|good|fine|high|low)|egfr of \d|interpret (my|these|this)|what do my .* (mean|show)/)) {
    return { kind:'hardstop', cluster:'results', nurse:true, text:`Wanting to actually understand what's in your report — instead of just being handed a result — is completely reasonable.\n\nI can explain what the terms generally mean, but I can't tell you what your specific numbers mean for you. Reading your results in the context of your whole case is your care team's job, and that's not a call worth getting wrong.\n\n${prov} can walk you through your results, or you can send your question to our clinical team.` }
  }
  if (has(/second opinion|another (doctor|oncologist|opinion)|different (doctor|oncologist)|right doctor|see someone else|switch doctors/)) {
    return { kind:'hardstop', cluster:'secondopinion', nurse:true, text:`Wanting another perspective doesn't mean anything is wrong — it's a common, completely reasonable thing to consider, and good care teams expect it.\n\nWhether to seek one in your situation depends on details of your case I shouldn't weigh in on. But I can say plainly that a second opinion is a normal part of cancer care, not something you need to feel awkward about.\n\nIf you'd like to think it through, our clinical team can tell you what the process looks like.` }
  }

  // ── DIRECT NURSE REQUEST — surface the handoff CTA inline (not a hard stop) ──
  if (has(/\bnurse\b|chat with (a )?(nurse|someone|human)|(talk|speak) (to|with) (a )?(nurse|someone|human|real person|person)|human (agent|support)|real person/)) {
    return { kind:'answer', text:`You can send your question to our clinical team, and they'll get back to you.`, nurse:true, askPrefill:false }
  }

  // ── CAPTURE (first-person statements) — offer to save before answering ──
  if (!has(/\?/) && has(/\b(i just started|i started taking|i started|i'?ve started|i began taking|i'?m now on|i'?m on|started me on|i'?m taking)\b/)) {
    const m = t.match(/(?:i just started|i started taking|i started|i'?ve started|i began taking|started me on|i'?m now on|i'?m on|i'?m taking)\s+(.+)/)
    // Strip a leading "taking "/"to take " the trigger didn't consume (e.g. "I just started taking X" → "X").
    const rawAll = m ? m[1].replace(/^\s*(taking|to take)\s+/i, '').replace(/[.?!;].*$/, '') : ''
    // Split a multi-drug mention ("Xeloda, Tylenol, and aspirin") into separate offers. Drug names are short, so
    // drop long phrases (a naive guard against the greedy match grabbing trailing sentence text); cap generously.
    const parts = rawAll.split(/\s*(?:,|&|\band\b|\bplus\b|\balong with\b|\bas well as\b)\s*/i)
      .map(s => s.replace(/\s+(yesterday|today|this (morning|afternoon|evening|week)|now|recently|\d.*)$/i, '').trim())
      .filter(p => p && p.split(/\s+/).length <= 3)
      .slice(0, 8)
    const meds = []
    for (const p of parts) {
      const low = p.toLowerCase()
      // Offer-gating (PRD §14): if the assistant can already see this med on record, don't offer it.
      if (low && (ctx.medNames || []).some(n => n === low || n.includes(low) || low.includes(n))) continue
      meds.push(p.charAt(0).toUpperCase() + p.slice(1))
    }
    if (!meds.length) return { kind:'answer', text:`Sounds good 👍` }
    return { kind:'answer', text:``, capture:{ type:'medication', meds } }
  }
  if (has(/(appointment|appt|visit)\b/) && has(/\bi (have|'?ve got|booked|'?m seeing)\b|next (mon|tue|wed|thu|fri|sat|sun|week)|on (mon|tue|wed|thu|fri|sat|sun)/) && !has(/when|next (appointment|appt|visit|scan)\b/)) {
    return { kind:'answer', text:`Noted — I can keep that in mind for future chats if you add it to your plan.`, capture:{ log:'care plan' } }
  }
  if (!has(/side ?effect|should i/) && has(/\bi(?:'ve| have| ve)?\b.*(headache|nausea|vomit|rash|dizz|fever|diarrh|constipat|\bpain\b|ache|bleeding|swelling|numb|tingl|short(ness)? of breath|cough)/)) {
    const symMap = [[/headache/, 'Headache'], [/nausea/, 'Nausea'], [/vomit/, 'Vomiting'], [/rash/, 'Rash'], [/dizz/, 'Dizziness'], [/fever/, 'Fever'], [/diarrh/, 'Diarrhea'], [/constipat/, 'Constipation'], [/short(ness)? of breath/, 'Shortness of breath'], [/cough/, 'Cough'], [/swelling/, 'Swelling'], [/numb|tingl/, 'Numbness or tingling'], [/back pain/, 'Back pain'], [/chest pain/, 'Chest pain'], [/\bpain\b|ache/, 'Pain']]
    const hit = symMap.find(([re]) => has(re))
    return { kind:'answer', text:`That sounds uncomfortable. It's worth keeping an eye on, and telling your care team if it persists or worsens.`, capture:{ type:'symptom', log:'symptom log', prefill:{ name: hit ? hit[1] : null, note: (raw || '').trim() } } }
  }
  if (has(/\bher2\b|\bbrca\b|my (biomarker|mutation|marker) (is|was)|i also have (diabet|hypertens|high blood|copd|asthma|kidney disease|heart)|i'?m (also )?diabetic/)) {
    return { kind:'answer', text:`Thanks — details like that help complete your profile so answers are more specific to you.`, capture:{ log:'profile' } }
  }

  // ── NEEDS DATA (fetch from the patient's record) ──
  if (has(/next (appointment|appt|visit|scan|check-?up)|upcoming (appointment|appt|visit|scan)|when('?s| is) my (next )?(appointment|appt|visit|scan)/)) {
    const next = ctx.nextAppointment
    if (next) return { kind:'answer', text:`Your next appointment on your timeline is ${next.name}, ${chatRelDate(next.date)}.`, source:'Based on your Outcomes4Me timeline' }
    return { kind:'answer', text:`I don't see an upcoming appointment on your timeline right now. If you have one scheduled, add it to your plan and I can reference it in future chats.` }
  }
  if (has(/what stage am i|what'?s my stage|which stage am i|my stage\b|what is my stage/)) {
    return { kind:'answer', text:`Your profile shows ${ctx.stageLabel} ${ctx.histology}${ctx.cancerName}. I'm reading that straight from your record — what it means for your care is a conversation for your team.`, source:'Based on your Outcomes4Me profile' }
  }
  if (has(/what (meds|medications?) am i (on|taking)|my medication list|am i (on|taking) any (meds|medications?)|when do i take my (meds|medication)/)) {
    const names = (ctx.medications || []).map(m => m && m.name).filter(Boolean)
    if (names.length) return { kind:'answer', text:`Your medication list has: ${names.join(', ')}.`, source:'Based on your Outcomes4Me medication list' }
    return { kind:'answer', text:`I don't see any medications in your list yet. If you add them, I can reference them here.` }
  }
  if (has(/clinical trial|\btrial\b|experimental|research study/)) {
    return { kind:'answer', text:`There may be clinical trials relevant to ${ctx.stageLabel} ${ctx.cancerName}. Trials are matched on your diagnosis details and location — a good one to explore with your care team, who can also flag trials they think fit.` }
  }

  // ── INSUFFICIENT DATA (records-dependent, can't answer) ──
  if (has(/how am i (doing|responding)|is (it|the treatment|my treatment) working|my (latest |recent )?(labs?|blood|test results?)|results over time|trend|how('?s| is) my (kidney|liver|blood|function)/)) {
    if (!ctx.hasRecords) return { kind:'insufficient', scenario:'A', text:`To answer that well, I'd need access to your health records — things like your recent labs and test results. Right now you haven't connected a provider portal, so I don't have that detail.\n\nConnecting your records takes just a few minutes and would let me give you a much more specific answer.`, connect:{ label:'Connect your health records', target:'connect-records' } }
    return { kind:'insufficient', scenario:'B', text:`I have your connected records, but I don't see the specific detail I'd need to answer that — like recent lab values or the relevant report. Sometimes records take a little time to fully sync, or the information may be held by a different provider.\n\nIt's worth checking back shortly, or connecting another provider portal if that data lives elsewhere.`, connect:{ label:'Connect an additional provider portal', target:'add-portal' } }
  }

  // ── ANSWERS (guideline / label / education) ──
  if (has(/fatigue|tired|exhaust|no energy|worn out|drained/)) {
    return { kind:'answer', text:`According to NCCN supportive-care guidance, fatigue during treatment is common and often builds over time. Strategies that help many patients: keep a consistent sleep schedule, get light activity like a short walk when your energy allows, and track when your fatigue peaks so you can plan lighter days around it.`, source:'NCCN Guidelines — Cancer-Related Fatigue' }
  }
  if (has(/side ?effect|pembro|immunotherapy|nausea|rash|thyroid|what does .* (do|treat)/)) {
    return { kind:'answer', text:`I can share what's on the FDA label. Immunotherapies like pembrolizumab can cause fatigue, rash, and — less commonly — immune-related effects such as thyroid changes. Most are manageable, and your team monitors for them with routine labs.`, source:'FDA label — Important Safety Information' }
  }
  if (has(/between scans|watch for|surveillance|what should i (watch|look) for|warning sign|when to (call|worry)|red flag/)) {
    return { kind:'answer', text:`For ${ctx.stageLabel} ${ctx.cancerName} on surveillance, NCCN guidelines focus on periodic imaging and check-ins. Between scans, symptoms worth reporting include unexplained pain, new or worsening fatigue, or blood in your urine — sooner rather than waiting for your next scan.`, source:'NCCN Guidelines — Kidney Cancer, surveillance' }
  }
  if (has(/nephrectomy|laparoscopic|robotic|open surgery|surgery (recovery|approach)|recovery (after|from) surgery|partial (vs|versus) radical/)) {
    return { kind:'answer', text:`In general terms: a partial nephrectomy removes just the tumor and spares the rest of the kidney; a radical removes the whole kidney. Robotic and laparoscopic approaches are both minimally invasive — usually smaller incisions and a shorter recovery than open surgery. Which is appropriate depends on the tumor and your anatomy, so that call is your surgeon's.`, source:'NCCN Guidelines — Kidney Cancer' }
  }
  if (has(/what does nccn|nccn (say|recommend|guideline)|what are (my|the) (options|guidelines)|guidelines? say|options for (my )?(treatment|stage|rcc|kidney)|surveillance (vs|versus) adjuvant/)) {
    return { kind:'answer', text:`For ${ctx.stageLabel} clear cell kidney cancer, NCCN generally describes surgery followed by either active surveillance or, for higher-risk cases, adjuvant therapy. I'm describing the guideline in general — which path fits you is your oncologist's call with your full pathology.`, source:'NCCN Guidelines — Kidney Cancer' }
  }
  if (has(/clear cell|what is rcc|what('?s| is) (kidney cancer|rcc)|what does (clear cell|my diagnosis|rcc|pt1b|pt1|grade) mean|what('?s| is) (a |my )?(grade|stage)\b|stage mean|pt1b/)) {
    return { kind:'answer', text:`In general terms: "clear cell" is the most common type of kidney cancer cell under the microscope, "stage" describes how far it has spread, and a code like "pT1b" describes the tumor's size and how localized it was. ${ctx.stageLabel} means it was found early and localized. I'm describing these generally — for what they mean in your specific case, your care team is the best source.`, source:'NCCN Guidelines — Kidney Cancer' }
  }
  if (has(/other (patients|people)|anyone else|what did (others|people)|hair loss|peer|community|support group|others going through|have others|others (found|do|did)/)) {
    return { kind:'answer', text:`That's the kind of thing other patients often have real, lived-experience answers for — people who've been through similar treatment tend to share what actually helped. Worth hearing those alongside anything clinical.` , connect:{ label:'Go to Community', target:'community' }}
  }

  // Emotional difficulty (not a crisis): warm support, normal flow. Ask O4M is a last resort (a hard stop,
  // or a request for a person), so it isn't offered here.
  if (has(/this is (so|really) hard|i'?m (so )?scared|i'?m (so )?(overwhelmed|exhausted|frightened|anxious|terrified)|i can'?t cope|struggling emotionally|feel(ing)? (so )?alone/)) {
    return { kind:'answer', text:`That sounds really heavy. It's completely understandable to feel this way going through treatment, and you don't have to carry it alone. A lot of people find support from others going through the same thing.`, connect:{ label:'Go to Community', target:'community' } }
  }

  // FALLBACK
  return { kind:'answer', text:`I can help with questions about your diagnosis, treatment and side effects, your care plan, and what to expect — grounded in NCCN guidelines and your own Outcomes4Me data. Try asking about a side effect, what to watch for between scans, or your next appointment.` }
}

// Topic label for chat-history titles — mirrors routeChat's classification order.
const chatTopic = (raw) => {
  const t = (raw || '').toLowerCase()
  const has = (re) => re.test(t)
  if (has(/recur|come ?back|coming back|spread|surviv|prognos|my odds|life expectanc|going to die|will i die|be cured|is it terminal/)) return 'Recurrence & prognosis'
  if (has(/should i (stop|start|switch|change|lower|quit|do|take|choose)|do i qualify|keynote|am i eligible|eligible for|adjuvant.*or.*surveillance/)) return 'Treatment decision'
  if (has(/what does my (scan|path|result|report|lab|blood)|my (scan|pathology|results?|labs?|egfr)\b.*(mean|show|say)|is my (egfr|scan|result|lab)\b.*(normal|okay|ok|bad|good|fine)|egfr of \d|interpret (my|these|this)/)) return 'Understanding results'
  if (has(/second opinion|another (doctor|oncologist|opinion)|different (doctor|oncologist)|right doctor/)) return 'Second opinion'
  if (!has(/\?/) && has(/\b(i just started|i started taking|i'?ve started|i began taking|i'?m now on|started me on|i'?m taking)\b/)) return 'New medication'
  if (has(/(appointment|appt|visit)\b/) && has(/\bi (have|'?ve got|booked|'?m seeing)\b|next (mon|tue|wed|thu|fri|sat|sun|week)/) && !has(/when|next (appointment|appt|visit|scan)\b/)) return 'New appointment'
  if (!has(/side ?effect|should i/) && has(/\bi(?:'ve| have| ve)?\b.*(headache|nausea|vomit|rash|dizz|fever|diarrh|\bpain\b|ache|bleeding|swelling|numb|tingl|cough)/)) return 'New symptom'
  if (has(/\bher2\b|\bbrca\b|my (biomarker|mutation|marker) (is|was)|i also have (diabet|hypertens|copd|asthma)/)) return 'Health detail'
  if (has(/next (appointment|appt|visit|scan|check-?up)|upcoming (appointment|appt|visit|scan)|when('?s| is) my (next )?(appointment|appt|visit|scan)/)) return 'Next appointment'
  if (has(/what stage am i|what'?s my stage|which stage am i|my stage\b|what is my stage/)) return 'Your diagnosis'
  if (has(/what (meds|medications?) am i (on|taking)|my medication list|am i (on|taking) any (meds|medications?)/)) return 'Your medications'
  if (has(/clinical trial|\btrial\b|experimental|research study/)) return 'Clinical trials'
  if (has(/how am i (doing|responding)|is (it|the treatment|my treatment) working|my (latest |recent )?(labs?|blood|test results?)|results over time|trend/)) return 'Treatment progress'
  if (has(/fatigue|tired|exhaust|no energy|worn out|drained/)) return 'Managing fatigue'
  if (has(/side ?effect|pembro|immunotherapy|nausea|rash|thyroid/)) return 'Medication side effects'
  if (has(/between scans|watch for|surveillance|warning sign|red flag/)) return 'Between-scan symptoms'
  if (has(/nephrectomy|laparoscopic|robotic|surgery (recovery|approach)|partial (vs|versus) radical/)) return 'Surgery options'
  if (has(/what does nccn|nccn (say|recommend|guideline)|what are (my|the) (options|guidelines)|options for (my )?(treatment|stage|rcc|kidney)/)) return 'Treatment options'
  if (has(/clear cell|what is rcc|what('?s| is) (kidney cancer|rcc)|what does (clear cell|my diagnosis|rcc|pt1b|grade) mean|what('?s| is) (a |my )?(grade|stage)\b|stage mean|pt1b/)) return 'Understanding your diagnosis'
  if (has(/other (patients|people)|anyone else|what did (others|people)|hair loss|peer|community|support group/)) return "Others' experiences"
  return null
}

// Inline citation
const ChatSource = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
    <span className="material-symbols-rounded" style={{ fontSize: 13, color: C.textTertiary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>verified</span>
    <span style={{ fontSize: 12, lineHeight: '16px', color: C.textTertiary, fontWeight: 400 }}>{label}</span>
  </div>
)

// Tappable deep link — neutral gray outline, dark text (keeps orange for the chat itself)
// History row date: when the conversation's last message was sent or received (opening or reading
// doesn't change it). "Today", "Yesterday", "Oct 22" this year, "Oct 22, 2025" in earlier years.
const chatRowDate = (d) => {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}
const ChatDeepLink = ({ label, target, onDeepLink }) => (
  // A link into the app from an answer: chat's secondary (gray fill, dark blue label and arrow), 36,
  // pill (it's sized to its label). In chat, light orange belongs to your bubbles only.
  <button onClick={() => onDeepLink(target)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content', maxWidth: '100%', padding: '10px 16px', boxSizing: 'border-box', minHeight: 36, backgroundColor: C.bgApp, color: C.primary, border: 'none', borderRadius: 9999, fontSize: 14, lineHeight: '16px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
    <span>{label}</span>
    <span className="material-symbols-rounded" style={{ fontSize: 16, color: C.primary, fontVariationSettings: "'wght' 500" }}>arrow_forward</span>
  </button>
)

// Priority handoff — same bordered-block CTA shape as capture, but emphasized (light-orange
// background, orange border, orange button) since it's the highest-stakes action in chat.

// Crisis / emergency treatment — its own serious register, deliberately NOT the CTA palette
// (no brand orange, no red). Calm, resources-first, non-dismissible. (CHAT-13)
// Crisis and emergency response. Calm look (no brand orange, no red): chat's actions are dark blue
// (primary: dark blue fill; secondary: gray fill, dark blue label). Safety actions are never small:
// 44, Label medium. The prototype can't call or text, so a tap explains what happens in the app.
const CHAT_DARK = '#162937'
const ChatCrisis = ({ resp }) => {
  // Emergency and crisis responses: chat's message in plain text, then one outlined card: a small icon and
  // the title, a one-line description, the buttons (44, Label medium, labels only; the first is the dark
  // blue primary, the rest gray secondaries), then a footnote. No brand orange. The prototype can't call
  // or text, so a tap explains what happens in the app.
  const [tapped, setTapped] = useState(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 16, color: C.textPrimary, lineHeight: '24px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{resp.text}</div>
      {!resp._streaming && (resp.resources || []).map((r, i) => (
        <div key={i} style={{ borderRadius: 12, padding: 15, border: '1px solid rgba(0,0,0,0.12)', backgroundColor: C.bgCard }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 22, color: r.iconColor, fontVariationSettings: "'FILL' 0, 'wght' 500" }}>{r.icon}</span>
            <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: C.textPrimary }}>{r.name}</div>
          </div>
          <div style={{ fontSize: 14, lineHeight: '20px', color: C.textSecondary, marginTop: 4 }}>{r.sub}</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(r.rows || []).map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 8 }}>
                {row.map((a, k) => {
                  const primary = a.kind === 'primary'
                  return (
                    <button key={k} onClick={() => setTapped(i + '|' + a.does)} style={{ flex: 1, height: 44, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', borderRadius: 9999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 16, lineHeight: '20px', fontWeight: 600, backgroundColor: primary ? CHAT_DARK : C.bgApp, color: primary ? '#fff' : CHAT_DARK }}>{a.label}</button>
                  )
                })}
              </div>
            ))}
          </div>
          {r.foot && <div style={{ marginTop: 8, fontSize: 12, lineHeight: '16px', color: C.textSecondary }}>{r.foot}</div>}
          {tapped && tapped.startsWith(i + '|') && <div style={{ marginTop: 8, fontSize: 12, lineHeight: '16px', color: C.textSecondary }}>In the app, this opens your phone to {tapped.split('|')[1]}. Nothing is sent or dialed in this prototype.</div>}
        </div>
      ))}
    </div>
  )
}

// Care team prompt on clinically related answers (the ones with a source). We don't have the care
// team's contact details, so it uses the phone's share sheet, like the app's AI agents: the doctor's
// name and their question are filled in, and the person picks how to send it (or copies it).
const ChatCareTeam = ({ providerName, question }) => {
  // A short follow-up message from chat that says why, then the button (the same pattern as "Go to Community").
  // Shown once per conversation, after the first clinically related answer, so it stays available without repeating.
  const [copied, setCopied] = useState(false)
  const doc = providerName ? shortProvider(providerName) : ''
  const text = `${doc ? `Hi ${doc}, I` : 'I'} have a question${question ? `: "${question}"` : '.'}`
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'A question for my care team', text }); return } } catch (e) { return }
    try { await navigator.clipboard.writeText(text) } catch (e) {}
    setCopied(true)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 16, lineHeight: '24px', color: C.textPrimary }}>{doc ? `If you'd like to ask ${doc} about this, you can share your question with them.` : `If you'd like to ask your care team about this, you can share your question with them.`}</div>
      <button onClick={share} style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '10px 16px', minHeight: 36, boxSizing: 'border-box', backgroundColor: C.bgApp, color: C.primary, border: 'none', borderRadius: 9999, fontSize: 14, lineHeight: '16px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        <span>Share with your care team</span>
        <span className="material-symbols-rounded" style={{ fontSize: 16, color: C.primary, fontVariationSettings: "'wght' 500" }}>ios_share</span>
      </button>
      {copied && <div style={{ fontSize: 12, lineHeight: '16px', color: C.textSecondary }}>Copied{doc ? `. Paste it into a message to ${doc}` : '. Paste it into a message to your care team'}. (On a phone, this opens the share sheet.)</div>}
    </div>
  )
}

// Inline capture prompt — lightweight in-chat save (P0 stand-in; P1 is slide-up-and-return)
// In-chat offer block: question + single positive button. Nothing changes until the
// add is confirmed; then the user's answer (tapped option or their typed text) is
// recorded inside the block, below the question. The AI's follow-up is a separate reply.
const ChatCapture = ({ capture, onCapture, msgIndex }) => {
  const [localAnswer, setLocalAnswer] = useState(null)  // unwired types resolve cosmetically in place
  const wired = onCapture && capture.type === 'medication'
  const answer = capture.answer || localAnswer
  const resolved = !!capture.resolved || localAnswer != null
  const question = capture.type === 'medication'
    ? `Keeping your medication list current helps me give better answers. Want me to add ${capture.med || 'this medication'} to your medications?`
    : `Want me to add this to your ${capture.log}?`
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 14.5, color: C.textPrimary, marginBottom: capture.retired ? 0 : 10, lineHeight: 1.45 }}>{question}</div>
      {capture.retired ? null : resolved ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ backgroundColor: C.primaryLight, color: C.textPrimary, padding: '7px 12px', borderRadius: '14px 14px 4px 14px', fontSize: 13 }}>{answer}</div>
        </div>
      ) : (
        <button onClick={() => { const a = `Add ${capture.med || 'this medication'}`; if (wired) onCapture({ ...capture, msgIndex, answer: a }); else setLocalAnswer(a) }}
          style={{ padding: '8px 14px', borderRadius: 9, border: 'none', backgroundColor: C.bgApp, color: C.textPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Add {capture.med || 'this medication'}
        </button>
      )}
    </div>
  )
}

// Day separator when the date changes (and above the first message of an older chat); time
// separator after a pause of more than an hour. No per-message timestamps.
const chatSeparator = (prev, m) => {
  if (!m || !m.ts) return null
  const d = new Date(m.ts), sameDay = (x, y) => x.toDateString() === y.toDateString()
  const dayLabel = (x) => {
    const today = new Date(), y = new Date(); y.setDate(today.getDate() - 1)
    if (sameDay(x, today)) return 'Today'
    if (sameDay(x, y)) return 'Yesterday'
    return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (!prev || !prev.ts) return sameDay(d, new Date()) ? null : dayLabel(d)
  const pd = new Date(prev.ts)
  if (!sameDay(pd, d)) return dayLabel(d)
  if (m.ts - prev.ts > 60 * 60 * 1000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return null
}

// Your messages: ORANGE_25, dark text, 12/16 padding, 16 corners; only the last bubble in a run
// of your messages gets the 4 "tail" corner. Max 82% of the conversation column.
const ChatUserBubble = ({ text, last = true }) => (
  <div style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: C.primaryLight, color: C.textPrimary, padding: '12px 16px', borderRadius: last ? '16px 16px 4px 16px' : 16, fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
)

// Thinking indicator — the 3-star sparkle, pulsing, before a reply lands
const ChatTyping = () => (
  <div style={{ alignSelf: 'flex-start', padding: '2px 2px' }}>
    <span className="material-symbols-rounded" style={{ display: 'inline-block', fontSize: 22, ...AI_ICON, fontVariationSettings: "'FILL' 1, 'wght' 400", transformOrigin: 'center', animation: 'chatSpark 1.1s ease-in-out infinite' }}>auto_awesome</span>
  </div>
)

// Same pulse, but labelled — shown while a question is pending in the dock and the composer is locked.
const ChatWaiting = () => (
  <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px' }}>
    <span className="material-symbols-rounded" style={{ display: 'inline-block', fontSize: 22, ...AI_ICON, fontVariationSettings: "'FILL' 1, 'wght' 400", transformOrigin: 'center', animation: 'chatSpark 1.1s ease-in-out infinite' }}>auto_awesome</span>
    <span style={{ fontSize: 13.5, color: C.textSecondary }}>Waiting for your response</span>
  </div>
)

// Question dock — pinned above the composer. The user must resolve it (pick an option or Skip) before
// the composer re-enables; consecutive questions step through a pager. Replaces inline offer blocks.
// Question box: chat asks, the person answers. The answers are the option card's compact variant
// (numbered instead of a radio): white with a BLACK_12 border at rest; when chosen, ORANGE_25 with an
// orange border (the option card's selected state), then it sends. One choice at a time, like
// onboarding. Skip / Not now is the tertiary button. Only the docked container is chat's own.
const ChatQuestionDock = ({ q, onAnswer, onSkip }) => {
  const [chosen, setChosen] = useState(null)
  const choose = (opt, i) => {
    if (chosen !== null) return
    setChosen(i)
    setTimeout(() => (opt._decline ? onSkip() : onAnswer(opt)), 180)
  }
  return (
    <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 16, backgroundColor: C.bgCard, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)', padding: 15, marginBottom: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, lineHeight: '24px' }}>{q.prompt}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...q.options, ...(q.skip ? [{ label: q.skipLabel || 'Not now', _decline: true }] : [])].map((opt, i) => {
          const on = chosen === i
          return (
            <button key={i} onClick={() => choose(opt, i)} aria-pressed={on} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: on ? '10.5px 11.5px' : '11px 12px', boxSizing: 'border-box', minHeight: 48, border: on ? `1.5px solid ${C.primary}` : '1px solid rgba(0,0,0,0.12)', borderRadius: 12, backgroundColor: on ? C.primaryLight : C.bgCard, cursor: chosen === null ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'background-color 0.12s ease' }}>
              <span style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: on ? C.primary : C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: on ? '#fff' : C.textSecondary, flexShrink: 0, transition: 'background-color 0.12s ease' }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 16, lineHeight: '24px', color: C.textPrimary, fontWeight: 400 }}>{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ChatAiBubble = ({ resp, providerName, onDeepLink, onCapture, msgIndex, question, careTeam }) => {
  const isHardstop = resp.kind === 'hardstop'
  if (resp.kind === 'crisis') {
    return <div style={{ alignSelf: 'stretch' }}><ChatCrisis resp={resp} onDeepLink={onDeepLink}/></div>
  }
  return (
    <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 16, color: C.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {String(resp.text || '').split(/\n\n+/).map((para, pi) => <div key={pi} style={{ marginTop: pi ? 12 : 0 }}>{para}</div>)}
        {resp.source && !resp._streaming && <ChatSource label={resp.source}/>}
      </div>
      {!resp._streaming && resp.connect && resp.kind !== 'insufficient' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resp.connect && <ChatDeepLink {...resp.connect} onDeepLink={onDeepLink}/>}
        </div>
      )}
      {!resp._streaming && careTeam && <div style={{ marginTop: 4 }}><ChatCareTeam providerName={providerName} question={question}/></div>}
    </div>
  )
}

// Starter-view legal footer — sourcing language per PRD §8 / Overview
const ChatLegal = ({ compact }) => (
  <div style={{ fontSize: 12, color: C.textTertiary, lineHeight: '16px', textAlign: 'left', padding: compact ? '0' : '18px 0 6px' }}>
    Chat is AI and can make mistakes. Always confirm care decisions with your care team.
  </div>
)

// Composer — send button inside the field, taller than a prompt chip
const ChatComposer = ({ value, onChange, onSend, generating, disabled, disabledText, onFocusChange }) => {
  const canSend = value.trim() && !generating && !disabled
  const taRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const MAX_H = 150
  // Grow the field to fit its content up to MAX_H, then scroll inside. Runs on every value
  // change so it grows as you type and shrinks back when text is cleared/sent.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    // Grow in whole 24-pt lines (15 + 24 per line + 15), so one line is exactly 54 (+2 border = 56).
    const lines = Math.max(1, Math.round((el.scrollHeight - 30) / 24))
    const h = Math.min(30 + lines * 24, MAX_H)
    el.style.height = h + 'px'
    el.style.overflowY = el.scrollHeight > MAX_H ? 'auto' : 'hidden'
  }, [value])
  return (
    <div style={{ position: 'relative', backgroundColor: C.bgCard, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 28, boxShadow: focused && !disabled ? '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)' : 'none', transition: 'box-shadow 0.18s ease', opacity: disabled ? 0.38 : 1 }}>
      <textarea ref={taRef} value={value} onFocus={() => { setFocused(true); onFocusChange && onFocusChange(true) }} onBlur={() => { setFocused(false); onFocusChange && onFocusChange(false) }} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) onSend() } }} rows={1} disabled={disabled} placeholder={disabled ? (disabledText || 'Start a new chat to continue') : 'Write a message…'} style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 54, maxHeight: MAX_H, resize: 'none', border: 'none', outline: 'none', background: 'transparent', padding: '15px 54px 15px 16px', fontSize: 16, lineHeight: '24px', fontFamily: 'inherit', color: C.textPrimary, overflowY: 'hidden', cursor: disabled ? 'default' : 'text' }}/>
      <button onClick={() => canSend && onSend()} disabled={!canSend} aria-label="Send" style={{ position: 'absolute', right: 9, bottom: 9, width: 36, height: 36, borderRadius: 18, border: 'none', backgroundColor: canSend ? C.primary : '#E4E4E4', cursor: canSend ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.15s' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'white', fontVariationSettings: "'FILL' 1, 'wght' 500" }}>arrow_upward</span>
      </button>
    </div>
  )
}

const ChatPrompts = ({ suggestions, onPick }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {suggestions.map((q, i) => (
      <button key={i} onClick={() => onPick(q)} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', backgroundColor: C.bgApp, border: 'none', borderRadius: 8, fontSize: 14, lineHeight: '20px', color: C.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span>{q}</span>
        <span style={{ flexShrink: 0 }}><Ico.chevRight/></span>
      </button>
    ))}
  </div>
)

// A single conversation. Shows greeting + composer + prompts when empty; message
// thread + composer once it has messages. Used inside the new-chat modal and the
// in-tab drilled session. Persists via onMessagesChange.
const ChatThread = ({ initialMessages, seed, ctx, providerName, greeting, suggestions, onDeepLink, onMessagesChange, threadId, onCapture, inject, onInjected, onNewChat, onAskClinical }) => {
  const [landingFocused, setLandingFocused] = useState(false)   // landing: prompts hide while the composer is focused
  const [messages, setMessages] = useState(initialMessages || [])
  const [input, setInput] = useState(() => getChatDraft(threadId))  // restore unsent draft for this chat
  useEffect(() => { saveChatDraft(threadId, input) }, [input, threadId])  // persist per conversation; cleared on send (input → '')
  const [generating, setGenerating] = useState(false)
  const [activeQ, setActiveQ] = useState(null)    // the current dock question; resolved (answer/Skip) before the composer re-enables. One at a time — the AI replies, then the next question pops up.
  const qSeq = useRef(0)
  const pendingCaptures = useRef([])              // "Add both" queues each med's add-flow, opened one after the other
  const scrollRef = useRef(null)
  const timerRef = useRef(null)
  const seededRef = useRef(false)
  const mountedRef = useRef(false)
  const injectedRef = useRef(null)
  const streamTimerRef = useRef(null)
  const streamingRef = useRef(false)

  const handleCapture = (cap) => { if (onCapture) onCapture({ type: cap.type, prefill: cap.prefill, threadId, msgIndex: cap.msgIndex, answer: cap.answer }) }

  // "Add both" walk-through: present the next queued med as its own confirm question (skippable). Each step
  // advances on its own resolution — Add (→ flow → save ack) or Skip — so skipping one still triggers the next.
  const stepChain = () => {
    const next = pendingCaptures.current[0]
    if (!next) return
    setActiveQ({ id: 'q' + (qSeq.current++), prompt: `Next, want me to add ${next.prefill.name}?`, options: [{ label: `Add ${next.prefill.name}`, kind: 'chain', caps: [next] }], skip: true, chain: true })
  }
  const enqueueCapture = (cap) => {
    let q = null
    if (cap.type === 'medication' && cap.meds && cap.meds.length) {
      const capOf = (name) => ({ type: 'medication', prefill: { name } })
      const listNames = (a) => a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`
      // One radio question: an "Add {med}" per med, plus "Add all" that walks each (skippable) — so it covers a
      // single, all, or any subset (Add all → skip the ones you don't want). Meds already on record are filtered out.
      const options = cap.meds.map(med => ({ label: `Add ${med}`, kind: 'capture', caps: [capOf(med)] }))
      if (cap.meds.length > 1) options.push({ label: `${cap.meds.length === 2 ? 'Add both' : 'Add all'} (${listNames(cap.meds)})`, kind: 'capture', caps: cap.meds.map(capOf) })
      const prompt = cap.meds.length > 1
        ? `Keeping your medication list current helps me give better answers. Want me to add these to your medications?`
        : `Keeping your medication list current helps me give better answers. Want me to add ${cap.meds[0]} to your medications?`
      q = { id: 'q' + (qSeq.current++), prompt, options, skip: true }
    } else if (cap.log) {
      q = cap.type === 'symptom'
        ? { id: 'q' + (qSeq.current++), prompt: `Want me to add this to your ${cap.log}?`, options: [{ label: 'Add it', kind: 'capture', caps: [{ type: 'symptom', prefill: cap.prefill }] }], skip: true }
        : { id: 'q' + (qSeq.current++), prompt: `Want me to add this to your ${cap.log}?`, options: [{ label: 'Add it', kind: 'note' }], skip: true }
    }
    if (q) setActiveQ(q)
  }
  // Clinical team handoff: chat asks, and "Yes, send it" opens the existing Ask O4M form with the
  // question filled in. Chat does nothing more (it doesn't send, track or show replies).
  const enqueueAsk = (resp) => {
    const question = resp.askPrefill === false ? '' : (resp._q || '')
    setActiveQ({ id: 'q' + (qSeq.current++), prompt: 'Would you like to send this question to our clinical team?', options: [{ label: 'Yes, send it', kind: 'ask', question }], skip: true, skipLabel: 'Not now', ask: true })
  }
  // Not enough data: a required question (no skip). The composer stays locked until they choose.
  // Without the information, chat holds back that answer; asking again brings the question back.
  const enqueueNeed = (resp) => {
    // Every answer, including the "no", reads as a direct reply to the question.
    const a = resp.scenario === 'A'
    setActiveQ({ id: 'q' + (qSeq.current++),
      prompt: a ? 'To answer this, I need your health records. Want to connect them?' : "I need a detail your records don't have. Can you tell me, or connect where it's held?",
      options: a ? [{ label: 'Connect my records', kind: 'need', act: 'connect' }, { label: "I'd rather not", kind: 'need', act: 'decline' }]
                 : [{ label: 'Tell you myself', kind: 'need', act: 'self' }, { label: 'Connect another portal', kind: 'need', act: 'portal' }, { label: "I don't know", kind: 'need', act: 'decline' }, { label: "I'd rather not", kind: 'need', act: 'decline' }],
      skip: false })
  }
  const openCap = (c, label) => { if (c && onCapture) onCapture({ type: c.type, prefill: c.prefill, threadId, answer: label }) }
  const answerQ = (opt) => {
    setMessages(prev => [...prev, { role: 'user', text: opt.label, ts: Date.now() }])
    setActiveQ(null)
    if (opt.kind === 'ask') { if (onAskClinical) onAskClinical(opt.question || ''); return }
    if (opt.kind === 'reanswer') { generateReply(opt.question); return }   // records are in: answer the original question
    if (opt.kind === 'need') {
      if (opt.act === 'connect') {
        onDeepLink('connect-records')
        // When records are ready, chat offers to answer the original question with one tap (never automatically).
        // The prototype simulates retrieval and processing with a short wait.
        const origQ = (messages.slice().reverse().find(m => m.role === 'user') || {}).text || ''
        if (origQ) setTimeout(() => setActiveQ(cur => cur ? cur : { id: 'q' + (qSeq.current++), prompt: `Your records are in. Want me to answer “${origQ}” now?`, options: [{ label: 'Yes, answer it', kind: 'reanswer', question: origQ }], skip: true, notNowText: `No problem. Just ask whenever you're ready.` }), 7000)
      }
      if (opt.act === 'portal') onDeepLink('add-portal')
      const text = opt.act === 'connect' ? `Thanks. Your records are on their way. Once they're in, I'll offer to answer this.`
        : opt.act === 'portal' ? `Thanks. Once those records are in, ask me again and I'll take another look.`
        : opt.act === 'self' ? `Okay, tell me in your own words. I'll save it as something you told me, not something from your records.`
        : `That's okay. I can't answer this one well without it, so I'll hold off. I'm happy to help with anything else.`
      setGenerating(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { setGenerating(false); deliver({ kind: 'answer', text }) }, 650 + Math.random() * 300)
      return
    }
    if (opt.kind === 'capture') {
      // From the initial question. Launch the first med's flow right away (a single "Add X", or the first of
      // "Add all" — they just committed). Any remaining meds are confirmed one at a time via the chain.
      pendingCaptures.current = (opt.caps || []).slice()
      const first = pendingCaptures.current.shift()
      openCap(first, first && first.prefill && first.prefill.name && first.type !== 'symptom' ? `Add ${first.prefill.name}` : opt.label)
    } else if (opt.kind === 'chain') {
      // A step in the "Add both" walk-through: consume this med and open its flow. The next step fires after its save ack.
      pendingCaptures.current.shift()
      openCap((opt.caps || [])[0], opt.label)
    } else {
      setGenerating(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { setGenerating(false); deliver({ kind: 'answer', text: `Got it — I'll keep that in mind for future chats.` }) }, 650 + Math.random() * 300)
    }
  }
  const skipQ = () => {
    const q = activeQ
    // "Not now" is a soft no, not a permanent decline — tell them how to add it later: re-state "I started X".
    const meds = q ? [...new Set((q.options || []).flatMap(o => (o.caps || []).map(c => c.prefill && c.prefill.name).filter(Boolean)))] : []
    const text = (q && q.notNowText) ? q.notNowText : (q && q.ask) ? `No problem. You can always send it later.` : meds.length === 1 ? `No problem. If you'd like to add it later, just tell me you started ${meds[0]}.`
      : meds.length > 1 ? `No problem. If you'd like to add any of them later, just let me know you started it.`
      : `No problem.`
    setMessages(prev => [...prev, { role: 'user', text: (q && q.skipLabel) || 'Not now', ts: Date.now() }])   // declining is an answer
    setActiveQ(null)
    const chained = q && q.chain
    if (chained) pendingCaptures.current.shift()   // skip this step; the next med still gets asked below
    setGenerating(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setGenerating(false)
      deliver({ kind: 'answer', text })
      if (chained && pendingCaptures.current.length) setTimeout(stepChain, 1000)
    }, 600 + Math.random() * 300)
  }

  // Stream a reply's text in progressively (no fade) — like live generation.
  // Attachments (citation / CTAs / capture) hold until the text finishes.
  const deliver = (resp) => {
    // Pure question (empty text + capture): no message bubble — the ask lives entirely in the dock.
    if (!(resp.text || '').trim() && resp.capture) { enqueueCapture(resp.capture); return }
    const tokens = (resp.text || '').split(/(\s+)/)  // words + whitespace preserved
    streamingRef.current = true
    setMessages(prev => [...prev, { role: 'ai', ts: Date.now(), resp: { ...resp, text: '', _streaming: true } }])
    let i = 0
    if (streamTimerRef.current) clearInterval(streamTimerRef.current)
    streamTimerRef.current = setInterval(() => {
      i = Math.min(tokens.length, i + 2)
      const shown = tokens.slice(0, i).join('')
      const done = i >= tokens.length
      setMessages(prev => {
        if (!prev.length) return prev
        const last = prev[prev.length - 1]
        if (last.role !== 'ai') return prev
        return prev.slice(0, -1).concat({ ...last, resp: { ...last.resp, text: shown, _streaming: !done } })
      })
      // On completion, surface any capture as a dock question (after the answer text has landed).
      if (done) { clearInterval(streamTimerRef.current); streamTimerRef.current = null; streamingRef.current = false; if (resp.capture) enqueueCapture(resp.capture); else if (resp.nurse) enqueueAsk(resp); else if (resp.kind === 'insufficient') enqueueNeed(resp) }
    }, 42)
  }

  const generateReply = (text) => {
    setGenerating(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const resp = { ...routeChat(text, ctx), _q: text }
      // A re-offer is suppressed only when the med is actually on record (the on-record check inside routeChat).
      // Skip and cancel are never permanent declines — re-stating "I started X" offers it again (that's the how-to
      // the skip reply gives). So the only thing that stops a re-offer is the med genuinely being saved.
      setGenerating(false)
      deliver(resp)
    }, 850 + Math.random() * 500)
  }
  // Composer send. The composer is locked while a question is pending, so there's no typed-affirmative
  // path to reconcile anymore — the dock is the only way to resolve a question.
  const runSend = (text) => {
    if (!text || generating || activeQ) return
    if (messages.length >= MSG_HARD_LIMIT) return  // session message cap reached (PRD §11)
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }])
    generateReply(text)
  }
  const send = (raw) => runSend((raw != null ? raw : input).trim())

  useEffect(() => { if (seed && !seededRef.current) { seededRef.current = true; runSend(seed) } }, [seed])
  // Resume: if the loaded thread ends on an unanswered user turn (e.g. closed mid-generation), finish the reply.
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!seed && last && last.role === 'user') generateReply(last.text)
    return () => { if (timerRef.current) clearTimeout(timerRef.current); if (streamTimerRef.current) clearInterval(streamTimerRef.current) }
  }, [])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages, generating])
  // Persist on real changes only — skip the mount fire so opening a chat doesn't re-date/re-sort it.
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (streamingRef.current) return  // don't persist mid-stream (spammy + re-dates); save once on completion
    if (onMessagesChange) onMessagesChange(messages)
  }, [messages])
  // Post-capture acknowledgment injected from App after a save completes.
  // Route it through the thinking state so it lands like a normal reply, not a silent pop-in.
  useEffect(() => {
    if (inject && inject.id !== injectedRef.current) {
      injectedRef.current = inject.id
      // Record the answer inside the offer block (question stays; answer appears below).
      if (inject.msgIndex != null) {
        setMessages(prev => prev.map((m, idx) => (idx === inject.msgIndex && m.resp && m.resp.capture)
          ? { ...m, resp: { ...m.resp, capture: { ...m.resp.capture, resolved: true, answer: inject.answer } } } : m))
      }
      // Then the AI follow-up, through the thinking beat, as a separate reply.
      setGenerating(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setGenerating(false)
        deliver({ kind: 'answer', text: inject.text })
        if (onInjected) onInjected()
        // "Add both": once this med's acknowledgment lands, ask about the next med as its own dock question —
        // the acknowledgment stays readable, and the next flow only opens on confirm.
        if (pendingCaptures.current.length) setTimeout(stepChain, 1100)
      }, 750 + Math.random() * 400)
    }
  }, [inject])

  if (messages.length === 0) {
    // Landing: the greeting fills the space above and stays centered vertically; the prompts,
    // composer and fine print are docked at the bottom. Focusing the composer hides the prompts
    // (they've chosen to type), and they come back when it's empty and unfocused.
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 18px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 34, ...AI_ICON, marginBottom: 12, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>auto_awesome</span>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, textAlign: 'center', lineHeight: 1.27 }}>{greeting}</div>
        </div>
        <div style={{ flexShrink: 0, backgroundColor: C.bgCard, padding: '0 16px 8px' }}>
          {!landingFocused && !input.trim() && <div style={{ marginBottom: 12, animation: 'hdrFade 0.2s ease' }}><ChatPrompts suggestions={suggestions} onPick={q => send(q)}/></div>}
          <ChatComposer value={input} onChange={setInput} onSend={() => send()} generating={generating} onFocusChange={setLandingFocused}/>
        </div>
      </div>
    )
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {messages.map((m, i) => {
          const lastAiIndex = messages.reduce((acc, x, k) => x.role !== 'user' ? k : acc, -1)
          const firstClinicalIndex = messages.findIndex(x => x.role !== 'user' && x.resp && x.resp.source && x.resp.kind === 'answer')
          const prev = messages[i - 1], next = messages[i + 1]
          const sep = chatSeparator(prev, m)
          const nextSep = next ? chatSeparator(m, next) : null
          const gapAbove = i === 0 || sep ? 0 : (prev.role === m.role ? 8 : 24)
          return (
            <Fragment key={i}>
              {sep && <div style={{ textAlign: 'center', fontSize: 12, lineHeight: '16px', color: C.textTertiary, fontWeight: 400, margin: (i === 0 ? '0' : '24px') + ' 0 16px' }}>{sep}</div>}
              <div style={{ marginTop: gapAbove, display: 'flex', flexDirection: 'column' }}>
                {m.role === 'user'
                  ? <ChatUserBubble text={m.text} last={!(next && next.role === 'user' && !nextSep)}/>
                  : <ChatAiBubble resp={m.resp} providerName={providerName} onDeepLink={onDeepLink} onCapture={handleCapture} msgIndex={i} question={prev && prev.role === 'user' ? prev.text : ''} careTeam={i === firstClinicalIndex}/>}
              </div>
              {/* The legal line sits right below chat's latest answer (16 apart). Not on the landing. */}
              {i === lastAiIndex && <div style={{ marginTop: 16 }}><ChatLegal compact/></div>}
            </Fragment>
          )
        })}
        {(generating || activeQ) && <div style={{ marginTop: messages.length ? 24 : 0 }}>{generating ? <ChatTyping/> : <ChatWaiting/>}</div>}
      </div>
      <div style={{ flexShrink: 0, backgroundColor: C.bgCard, padding: '0 16px 8px' }}>
        {/* Capturing information beats the length limit: at the limit, an open question still shows and
            can be answered (and whatever it starts runs, including follow-up questions); the limit notice
            shows above it, and the composer stays locked. */}
        {messages.length >= MSG_HARD_LIMIT && (
            <div style={{ backgroundColor: C.bgApp, borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: '20px' }}>You've reached the maximum length for this conversation. Start a new chat to keep going.</div>
              <button onClick={() => onNewChat && onNewChat()} style={{ alignSelf: 'flex-start', height: 36, boxSizing: 'border-box', padding: '0 16px', borderRadius: 9999, border: 'none', backgroundColor: C.primary, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>New chat</button>
            </div>
        )}
        {messages.length < MSG_HARD_LIMIT && messages.length >= MSG_SOFT_LIMIT && (
          // Soft nudge — persistent line above the composer; composer stays usable.
          <div style={{ fontSize: 14, color: C.textSecondary, backgroundColor: C.bgApp, borderRadius: 12, padding: '8px 16px', margin: '0 0 12px', lineHeight: '20px' }}>
            You're approaching the conversation limit. Consider starting a new chat soon.
          </div>
        )}
        {activeQ && <ChatQuestionDock key={activeQ.id} q={activeQ} onAnswer={answerQ} onSkip={skipQ}/>}
        <ChatComposer value={input} onChange={setInput} onSend={() => send()} generating={generating} disabled={!!activeQ || messages.length >= MSG_HARD_LIMIT} disabledText={activeQ ? 'Answer above to continue' : 'Start a new chat to continue'}/>
      </div>
    </div>
  )
}

// Body of the new-chat FlowShell modal — sets the nav title, hosts a fresh thread.
const ChatModalBody = ({ setNav, seed, threadId, ctx, providerName, greeting, suggestions, onDeepLink, onPersist, onCapture, captureAck, onInjected, onNewChat }) => {
  useEffect(() => { setNav({ title: '', subtitle: null, onBack: null }) }, [])
  return <ChatThread key={threadId} threadId={threadId} initialMessages={[]} seed={seed} ctx={ctx} providerName={providerName} greeting={greeting} suggestions={suggestions} onDeepLink={onDeepLink} onMessagesChange={m => onPersist(threadId, m)} onCapture={onCapture} inject={captureAck && captureAck.threadId === threadId ? captureAck : null} onInjected={onInjected} onNewChat={onNewChat}/>
}

const ChatScreen = ({ onAskClinical, patientState, timeline, medications, userName, onDeepLink, onDrilledChange, onDrillModeChange, onMenuOpenChange, onTabChange, kbOpen, backSignal, deleteSignal, menuSignal, newSignal, onOverflow, onCaptureFlow, captureAck, onAckConsumed, sheetMode = false, onClose = null, context = null }) => {
  const [sessions, setSessions] = useState([])
  const seqRef = useRef(0)
  const firstId = `c${Date.now()}-${seqRef.current++}`
  const [homeId, setHomeId] = useState(firstId)                 // the home surface (composer-first new chat)
  const [currentId, setCurrentId] = useState(firstId)           // what's on screen — home, or a chat drilled in from the menu
  const drilledIn = currentId !== homeId                        // opened an existing chat from the side menu
  const [menuOpen, setMenuOpen] = useState(false)           // history menu revealed beneath the app stack
  const [anim, setAnim] = useState(null)                    // drill transition: 'push' (in) | 'pop' (out) | null
  const [recordsConnected, setRecordsConnected] = useState(false)  // simulated health-records auth (shared with future gating)

  const firstName = (userName || '').trim().split(/\s+/)[0] || ''
  const greeting = firstName ? `Hi ${firstName}, ready when you are.` : 'Hi there, ready when you are.'
  const cancerName = CHAT_CANCER[patientState?.diagnosisCode] || 'your cancer'
  const histology = patientState?.biomarkers?.histology === 'clear-cell' ? 'clear cell ' : ''
  const stageLabel = patientState?.stage ? `Stage ${patientState.stage}` : ''
  const providerName = (CARE_TEAM && CARE_TEAM[0] && CARE_TEAM[0].name) || 'Dr. Chen'
  const nextAppointment = useMemo(() => {
    const todayStr = localDateStr()
    const appts = []
    ;(timeline || []).forEach(day => (day.events || []).forEach(e => { if (e.type === 'appointment' && e.date >= todayStr) appts.push(e) }))
    appts.sort((a, b) => a.date.localeCompare(b.date))
    return appts[0] || null
  }, [timeline])
  // Names the assistant can already see, for offer-gating (don't offer to add what's on record).
  // Both stores, since tracker and timeline are separate.
  const medNames = useMemo(() => {
    const names = []
    ;(medications || []).forEach(m => { if (m && m.name) names.push(m.name.toLowerCase()) })
    ;(timeline || []).forEach(day => (day.events || []).forEach(e => { if (e.type === 'medication' && e.name) names.push(e.name.toLowerCase()) }))
    return names
  }, [medications, timeline])
  const ctx = { cancerName, stageLabel, histology, providerName, hasRecords: recordsConnected, nextAppointment, medications: medications || [], medNames }

  // Deep-link interceptor: the insufficient-data connect action flips the simulated
  // records-connected flag (same flag the parked gating work will read); everything
  // else delegates to the app-level handler.
  const handleLink = (target) => {
    if (target === 'connect-records') { setRecordsConnected(true); markRecordsConnected() } // terminal: stops the engagement nudge
    onDeepLink(target)
  }

  const suggestions = (() => {
    // Contextual (by the surface chat was opened from) first, evergreen as the floor.
    // Object-level context (a specific treatment/trial/symptom) would slot ahead of these later.
    const CHAT_PROMPTS = {
      // Only questions chat answers directly (Question map "Chip" rows): never a hard stop,
      // a crisis response or a request for information.
      today:     ["When's my next appointment?", 'What should I watch for between scans?'],
      careplan:  ['What does my diagnosis mean?', 'What do the guidelines say for my stage?'],
      track:     ['How can I manage fatigue during treatment?', 'What side effects should I watch for?'],
      community: ['What have others found helpful?'],
    }
    const evergreen = [
      'What should I watch for between scans?',
      'How can I manage fatigue during treatment?',
      `What does clear cell ${cancerName} mean?`,
    ]
    const seen = new Set(); const out = []
    ;[...(CHAT_PROMPTS[context] || []), ...evergreen].forEach(q => { if (!seen.has(q)) { seen.add(q); out.push(q) } })
    return out.slice(0, 4)
  })()

  const newChatId = () => `c${Date.now()}-${seqRef.current++}`
  const upsert = (id, messages) => {
    if (!messages || !messages.length) return
    const firstQ = messages.find(m => m.role === 'user')
    const title = (firstQ && chatTopic(firstQ.text)) || (firstQ ? firstQ.text : 'New chat')
    const rec = { id, title, count: messages.length, date: new Date(), messages }
    setSessions(prev => [rec, ...prev.filter(x => x.id !== id)])
    // First send from the home surface promotes it to a drilled-in conversation and
    // mints a fresh empty home behind it — the Chat tab never lands you inside a chat.
    if (id === homeId && firstQ) setHomeId(newChatId())
  }
  const closeMenu = () => setMenuOpen(false)
  const startNewChat = () => {                                                     // compose / menu "+ New chat"
    const id = newChatId()
    if (currentId !== homeId) { setHomeId(id); setAnim('pop') }                    // drilled → pop the chat off, reveal a fresh home
    else { setHomeId(id); setCurrentId(id) }                                       // already home → reset to a fresh empty home
    setMenuOpen(false)
  }
  // menu-select → the app stack slides back over the menu, now showing the drilled chat (cover)
  const openChat = (id) => { setCurrentId(id); setMenuOpen(false) }
  const goHome = () => { if (currentId !== homeId) setAnim('pop'); else setCurrentId(homeId) }  // back → pop the chat off, uncover the home

  // Header hamburger toggles the history menu (slides the app stack aside to uncover it beneath the home).
  useEffect(() => { if (menuSignal) setMenuOpen(o => !o) }, [menuSignal])
  // Header compose starts a fresh chat.
  useEffect(() => { if (newSignal) startNewChat() }, [newSignal])
  // Header back arrow (drilled-in view) returns to the home surface.
  useEffect(() => { if (backSignal) goHome() }, [backSignal])
  // Report the current chat's title to the app header (null on a fresh/empty chat → hamburger only).
  const current = sessions.find(s => s.id === currentId) || null
  useEffect(() => { if (onDrilledChange) onDrilledChange(current ? current.title : null) }, [currentId, current && current.title])
  // Tell the app whether we're drilled into a chat (hide nav + show back) or on the home (nav + hamburger).
  // During a back-pop, report "home" at the start of the slide so the header transitions with the view, not after it.
  useEffect(() => { if (onDrillModeChange) onDrillModeChange(anim === 'pop' ? false : drilledIn) }, [drilledIn, anim])
  // Tell the app when the menu is open so the footer nav can slide aside with the home (it belongs to the home layer, above the menu).
  useEffect(() => { if (onMenuOpenChange) onMenuOpenChange(menuOpen) }, [menuOpen])
  // Delete the current chat (from the header overflow); drilled → back to home, home → fresh home.
  useEffect(() => { if (deleteSignal) {
    setSessions(prev => prev.filter(s => s.id !== currentId))
    if (currentId === homeId) { const id = newChatId(); setHomeId(id); setCurrentId(id) }
    else setCurrentId(homeId)
  } }, [deleteSignal])

  const current2 = sessions.find(s => s.id === currentId) || null
  const currentMessages = current2 ? current2.messages : []
  // App-bar state. During a back-pop, treat as home from the start of the slide so the bar transitions with the view.
  const headerDrilled = anim === 'pop' ? false : (currentId !== homeId)
  const headerTitle = current2 ? current2.title : null
  const abBtn = { width: 44, height: 44, flexShrink: 0, background: '#fff', borderRadius: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  // App bar that belongs to a view (home or chat), so it slides in/out with its screen — consistent both ways.
  const renderAppBar = (mode) => (
    <div style={{ flexShrink: 0, height: 60, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', backgroundColor: C.bgCard, position: 'relative' }}>
      {mode === 'chat'
        ? <button onClick={goHome} aria-label="Back" style={abBtn}><span className="material-symbols-rounded msr-600" style={{ fontSize: 26, color: C.textIcon }}>arrow_back</span></button>
        : <button onClick={() => setMenuOpen(o => !o)} aria-label="Chats menu" style={abBtn}><span className="material-symbols-rounded msr-600" style={{ fontSize: 25, color: C.textIcon, transform: 'scaleX(-1)' }}>segment</span></button>}
      {mode === 'chat' && headerTitle
        ? <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>{headerTitle}</div>
        : <div style={{ flex: 1 }}/>}
      {mode === 'chat' && <button onClick={startNewChat} aria-label="New chat" style={abBtn}><span className="material-symbols-rounded msr-600" style={{ fontSize: 23, color: C.textIcon }}>edit_square</span></button>}
      {mode === 'chat' && <button onClick={onOverflow} aria-label="More options" style={abBtn}><span className="material-symbols-rounded msr-600" style={{ fontSize: 22, color: C.textIcon }}>more_vert</span></button>}
      {/* Close only on the landing: inside a conversation the header is back, title, new chat and overflow. */}
      {sheetMode && mode !== 'chat' && <button onClick={() => onClose && onClose()} aria-label="Close" style={abBtn}><span className="material-symbols-rounded msr-600" style={{ fontSize: 24, color: C.textIcon }}>close</span></button>}
    </div>
  )
  // Footer nav lives inside the home layer so it slides with the home and the menu can run full-height beneath it.
  const renderFooter = () => (kbOpen || sheetMode) ? null : (
    <div style={{ flexShrink: 0 }}><BottomNav activeTab="chat" onTabChange={onTabChange}/></div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', overflow: 'hidden', backgroundColor: C.bgCard }}>
      <style>{`@keyframes chatDot { 0%,100%{opacity:0.25;transform:translateY(0)} 50%{opacity:1;transform:translateY(-2px)} } @keyframes chatSpark { 0%,100%{opacity:0.35;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.12)} } @keyframes chatViewIn { from{transform:translateX(100%)} to{transform:translateX(0)} } @keyframes chatViewOut { from{transform:translateX(0)} to{transform:translateX(100%)} } @keyframes chatPeekBack { from{transform:translateX(0);opacity:1} to{transform:translateX(-22%);opacity:0.55} } @keyframes chatPeekFwd { from{transform:translateX(-22%);opacity:0.55} to{transform:translateX(0);opacity:1} } @keyframes hdrFade{from{opacity:0}to{opacity:1}} .chatRow{background:transparent;transition:background 0.14s ease} .chatRow:hover{background:${C.bgApp}} .chatRow:active{background:${C.bgApp}} .chatRow.sel{background:${C.bgApp}}`}</style>

      {/* Stack, bottom → top: MENU (history) · HOME · CHAT. Sliding a layer aside uncovers the one beneath,
          so the menu reads as sitting *below* the home, and back/drill are the same uncover/cover motion.
          The app bar lives inside the app stack, so it slides with the home to uncover the menu's own header. */}

      {/* MENU — the base of the stack; its own header is revealed when the app stack slides aside. Tapping
          empty space here (anything that doesn't navigate) closes the menu. */}
      <div onClick={closeMenu} style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard }}>
        <div style={{ flexShrink: 0, height: 60, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary }}>Chats</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 90px' }}>
          {sessions.length === 0 ? (
            <div style={{ padding: '18px 20px', color: C.textTertiary, fontSize: 13.5, lineHeight: 1.5 }}>No chats yet. Ask something to start one.</div>
          ) : sessions.map(s => (
            <button key={s.id} className={`chatRow${s.id === currentId ? ' sel' : ''}`} onClick={(e) => { e.stopPropagation(); openChat(s.id) }} style={{ width: '74%', textAlign: 'left', padding: '12px 16px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                <div style={{ fontSize: 12, lineHeight: '16px', color: C.textTertiary, marginTop: 4 }}>{chatRowDate(s.date)}</div>
              </div>
              <span style={{ flexShrink: 0 }}><Ico.chevRight/></span>
            </button>
          ))}
        </div>
        <button onClick={(e) => { e.stopPropagation(); startNewChat() }} style={{ position: 'absolute', bottom: 20, left: 16, display: 'flex', alignItems: 'center', gap: 6, height: 44, boxSizing: 'border-box', padding: '0 20px', backgroundColor: C.primary, color: 'white', border: 'none', borderRadius: 9999, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.22)', fontSize: 16, fontWeight: 600 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'wght' 500" }}>add</span>
          New chat
        </button>
      </div>

      {/* APP STACK — each layer (home / drilled chat) carries its OWN app bar, so the bar travels with its
          view: it slides in with the chat on drill-in and slides back out with it on back — consistent both ways. */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, backgroundColor: C.bgCard, transform: menuOpen ? 'translateX(74%)' : 'translateX(0)', transition: 'transform 0.42s cubic-bezier(0.32,0.72,0,1)', boxShadow: menuOpen ? '-10px 0 30px rgba(0,0,0,0.18)' : 'none' }}>
        {/* home peek — behind the drilled chat, its own hamburger bar, parallax recede */}
        {currentId !== homeId && (
          <div key={'peek-' + homeId} style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard, pointerEvents: 'none', ...(anim === 'push' ? { animation: 'chatPeekBack 0.42s cubic-bezier(0.32,0.72,0,1) forwards' } : anim === 'pop' ? { animation: 'chatPeekFwd 0.42s cubic-bezier(0.32,0.72,0,1) forwards' } : { transform: 'translateX(-22%)', opacity: 0.55 }) }}>
            {renderAppBar('home')}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ChatThread key={homeId} threadId={homeId} initialMessages={[]} ctx={ctx} providerName={providerName} greeting={greeting} suggestions={suggestions} onDeepLink={handleLink} onMessagesChange={m => upsert(homeId, m)} onCapture={onCaptureFlow} inject={null} onInjected={onAckConsumed} onNewChat={startNewChat} onAskClinical={onAskClinical}/>
            </div>
            {renderFooter()}
          </div>
        )}
        {/* foreground — the home or the drilled chat, with its matching bar; keyed by currentId so send never changes slot */}
        <div
          onAnimationEnd={(e) => { if (e.target !== e.currentTarget) return; if (anim === 'pop') setCurrentId(homeId); setAnim(null) }}
          style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard, boxShadow: (currentId !== homeId || anim) ? '-8px 0 24px rgba(0,0,0,0.12)' : 'none', ...(anim === 'push' ? { animation: 'chatViewIn 0.42s cubic-bezier(0.32,0.72,0,1) forwards' } : anim === 'pop' ? { animation: 'chatViewOut 0.42s cubic-bezier(0.32,0.72,0,1) forwards' } : null) }}>
          {renderAppBar(currentId === homeId ? 'home' : 'chat')}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ChatThread key={currentId} threadId={currentId} initialMessages={currentMessages} ctx={ctx} providerName={providerName} greeting={greeting} suggestions={suggestions} onDeepLink={handleLink} onMessagesChange={m => upsert(currentId, m)} onCapture={onCaptureFlow} inject={captureAck && captureAck.threadId === currentId ? captureAck : null} onInjected={onAckConsumed} onNewChat={startNewChat} onAskClinical={onAskClinical}/>
          </div>
          {currentId === homeId && renderFooter()}
        </div>
        {/* Light scrim over the pushed-back home — lightens it (not darkens) so it recedes without reading as "below"; taps close the menu */}
        <div onClick={closeMenu} style={{ position: 'absolute', inset: 0, zIndex: 5, backgroundColor: 'rgba(255,255,255,0.55)', opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? 'auto' : 'none', transition: 'opacity 0.42s ease' }}/>
      </div>
    </div>
  )
}


const YouOverlay = ({ show, onClose, currentUser, onLogout, onAddPending, todOverride, onSetTod, fullView = false }) => {  // fullView: opened from chat
  const [vis, setVis] = useState(false)

  useEffect(() => {
    if (show) requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
    else setVis(false)
  }, [show])

  if (!show && !vis) return null

  const dismiss = () => {
    setVis(false)
    setTimeout(onClose, 320)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 140, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Dim backdrop */}
      <div onClick={dismiss} style={{
        position: 'absolute', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        opacity: vis ? 1 : 0,
        transition: 'opacity 0.32s ease',
      }}/>
      {/* Sheet */}
      <div style={{
        position: 'relative',
        height: fullView ? '100%' : '92%',
        backgroundColor: C.bgApp,
        borderRadius: fullView ? 0 : '20px 20px 0 0',
        paddingTop: fullView ? 'env(safe-area-inset-top, 0px)' : 0,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
      }}>
        {/* Drag handle (not on a full view) */}
        {!fullView && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }}/>
        </div>}
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Account</div>
          <button onClick={dismiss} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>close</span>
          </button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <YouScreen currentUser={currentUser} onLogout={onLogout} onAddPending={onAddPending} todOverride={todOverride} onSetTod={onSetTod}/>
        </div>
      </div>
    </div>
  )
}

const YouScreen = ({ currentUser, onLogout, onAddPending, todOverride, onSetTod }) => (
  <div style={{ flex: 1, overflowY: 'auto', paddingTop: 60, paddingBottom: 100, display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard }}>
    {/* Profile header */}
    <div style={{ backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, padding: '28px 20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: C.textIcon }}>{currentUser?.name?.charAt(0).toUpperCase() || '?'}</span>
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>{currentUser?.name || 'Guest'}</div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{currentUser?.email || ''}</div>
      </div>
    </div>

    {/* Settings rows */}
    <div style={{ padding: '16px 0' }}>
      {[
        { icon: 'person', label: 'Profile', sub: 'Name, date of birth' },
        { icon: 'medical_information', label: 'Medical profile', sub: 'Diagnosis, stage, histology' },
        { icon: 'notifications', label: 'Notifications', sub: 'Alerts and reminders' },
        { icon: 'privacy_tip', label: 'Privacy & data', sub: 'How your data is used' },
      ].map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.bgCard }}>
          <span className="material-symbols-rounded" style={{ fontSize: 22, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400", flexShrink: 0 }}>{row.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary }}>{row.label}</div>
            <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 1 }}>{row.sub}</div>
          </div>
          <span style={{ color: C.textTertiary, fontSize: 13 }}>›</span>
        </div>
      ))}
    </div>

    {/* Experiments panel — prototype variant switches */}
    <div style={{ padding: '20px 20px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>science</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Experiments</div>
      </div>
      <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 14 }}>Prototype variant switches. Changing one reloads the app.</div>
      <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {Object.keys(EXPERIMENT_META).map((key, i, arr) => {
          const meta = EXPERIMENT_META[key]
          const current = exp(key)
          return (
            <div key={key} style={{ padding: '13px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 9 }}>{meta.label}</div>
              <div style={{ display: 'inline-flex', backgroundColor: C.bgApp, borderRadius: 9, padding: 3, gap: 3 }}>
                {meta.values.map(v => {
                  const active = current === v
                  return (
                    <button key={v} onClick={() => { if (!active) setExperiment(key, v) }}
                      style={{ padding: '6px 16px', borderRadius: 7, border: 'none', cursor: active ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                        backgroundColor: active ? C.bgCard : 'transparent', color: active ? C.textPrimary : C.textSecondary,
                        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.12)' : 'none' }}>
                      {v}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={resetExperiments} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textSecondary, padding: '4px 0' }}>
        Reset to defaults
      </button>
      {onAddPending && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 8 }}>Testing triggers — stand-ins for actions that will fire upstream in production (a saved trial, a records request, etc.).</div>
          <button onClick={onAddPending} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: C.bgApp, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.primary }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.primary }}>add</span>
            Track a pending item
          </button>
          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 8 }}>
              Simulate the day rolling over — today's check-in settles into a past "Daily log" and the hub resets fresh.
              {(() => { let o = 0; try { o = parseInt(localStorage.getItem('o4m_dev_day_offset') || '0', 10) || 0 } catch (e) {} return o ? <span style={{ color: C.primary, fontWeight: 700 }}> Currently +{o} day{o > 1 ? 's' : ''} ahead.</span> : null })()}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { let o = 0; try { o = parseInt(localStorage.getItem('o4m_dev_day_offset') || '0', 10) || 0 } catch (e) {} try { localStorage.setItem('o4m_dev_day_offset', String(o + 1)) } catch (e) {} window.location.reload() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: C.bgApp, border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.primary }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.primary }}>skip_next</span>
                Advance a day
              </button>
              <button onClick={() => { try { localStorage.setItem('o4m_dev_day_offset', '0') } catch (e) {} window.location.reload() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textSecondary }}>
                Reset to real date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Dev: preview the Today time-of-day atmosphere (persisted as o4m_dev_tod) */}
    <div style={{ padding: '8px 20px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>Time of day (atmosphere)</div>
      <div style={{ fontSize: 12, color: C.textTertiary, lineHeight: 1.45, marginBottom: 9 }}>Preview the Today mood mark. Reset to Auto for the real time.</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[['auto', 'Auto'], ['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']].map(([key, label]) => {
          const on = (todOverride || 'auto') === key
          return (
            <button key={key} onClick={() => onSetTod && onSetTod(key === 'auto' ? null : key)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: on ? 'none' : `1px solid ${C.border}`, backgroundColor: on ? C.primary : C.bgCard, fontSize: 12, fontWeight: 700, color: on ? '#fff' : C.textSecondary, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{label}</button>
          )
        })}
      </div>
    </div>

    {/* Logout */}
    <div style={{ padding: '8px 20px 32px', marginTop: 8 }}>
      <button onClick={onLogout} style={{ width: '100%', height: 50, borderRadius: 12, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 400" }}>logout</span>
        Sign out
      </button>
      <div style={{ fontSize: 12, color: C.textTertiary, lineHeight: 1.45, margin: '16px 2px 8px' }}>Wipe all demo data (records, timeline, session, check-ins) and start fresh.</div>
      <button onClick={() => { try { localStorage.clear() } catch (e) {} try { sessionStorage.clear() } catch (e) {} window.location.reload() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: '#fdecea', border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#ef4444' }}>delete_sweep</span>
        Clear all demo data
      </button>
    </div>
  </div>
)

// ─── APP HEADER ───────────────────────────────────────────────────
// ─── APP HEADER ───────────────────────────────────────────────────
// ─── APP HEADER ───────────────────────────────────────────────────
// Floating header (v3.02): no bar. Every control is a white floating button with a Level 1
// shadow. Icon buttons are 44 circles; the Chat pill is 36 (Label small), tap area 44. A short fade in the page color keeps scrolling text clear of them.
const FLOAT_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 10px 28px rgba(0,0,0,0.035)'
const FADE_RGB = { careplan: '251,246,244', plan: '245,244,246', track: '255,255,255', community: '255,255,255', resources: '255,255,255' }
// v3.22: when a day is scrolled to the top (Jump to Today), leave its first card 16 below the
// floating header (60 + 16 = 76). The day's sentinel sits 48 above that card, so it lands at 28.
const DAY_TOP_OFFSET = 28
const AppHeader = ({ dayFade, activeTab = 'careplan', onProfileTap, onBack, onMenu, hideTitle, onOverflow, onNewChat, title, onAsk }) => {
  const r = 19, circ = 2 * Math.PI * r, dash = 0.62 * circ
  return (
    // Today (careplan): transparent, no bar — controls float as glass chips. Every
    // other tab: a translucent glass bar (collapse/reveal is handled by the parent).
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 60, padding: '0 16px', background: `linear-gradient(180deg, rgba(${FADE_RGB[activeTab] || '255,255,255'},0.96) 0%, rgba(${FADE_RGB[activeTab] || '255,255,255'},0.82) 62%, rgba(${FADE_RGB[activeTab] || '255,255,255'},0) 100%)`, flexShrink: 0 }}>
      <style>{`@keyframes hdrFade{from{opacity:0}to{opacity:1}}`}</style>
      {onBack ? (
        <button key="back" onClick={onBack} aria-label="Back" style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12, flexShrink: 0, cursor: 'pointer', border: 'none', backgroundColor: '#fff', boxShadow: FLOAT_SHADOW, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'hdrFade 0.24s ease' }}>
          <Ico.back/>
        </button>
      ) : onMenu ? (
        <button key="menu" onClick={onMenu} aria-label="Chats menu" style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12, flexShrink: 0, cursor: 'pointer', border: 'none', backgroundColor: '#fff', boxShadow: FLOAT_SHADOW, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'hdrFade 0.24s ease' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 25, color: C.textPrimary, transform: 'scaleX(-1)' }}>segment</span>
        </button>
      ) : (
      <div key="avatar" onClick={onProfileTap} role="button" aria-label="Profile" style={{ position: 'relative', width: 44, height: 44, marginRight: 12, flexShrink: 0, cursor: 'pointer', borderRadius: 22, backgroundColor: '#fff', boxShadow: FLOAT_SHADOW }}>
        <svg width="44" height="44" viewBox="0 0 46 46">
          <circle cx="23" cy="23" r={r} fill="none" stroke="#e8e8e8" strokeWidth="3"/>
          <circle cx="23" cy="23" r={r} fill="none" stroke="#4ade80" strokeWidth="3" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 23 23)"/>
        </svg>
        <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="3.5" stroke="#666" strokeWidth="1.5"/>
            <path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
      )}
      <div style={{ flex: 1 }}/>
      {onAsk && ['careplan', 'plan', 'track', 'community', 'resources'].includes(activeTab) && (  /* every main section */
        <button key="ask" onClick={onAsk} aria-label="O4M Chat" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', borderRadius: 9999, cursor: 'pointer', flexShrink: 0, position: 'relative', zIndex: 1, animation: 'hdrFade 0.24s ease', backgroundColor: '#fff', border: 'none', boxShadow: FLOAT_SHADOW }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, ...AI_ICON, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>auto_awesome</span>
          <span style={{ fontSize: 14, lineHeight: '16px', fontWeight: 600, color: C.primary }}>Chat</span>
        </button>
      )}
      {onNewChat && (
        <button key="compose" onClick={onNewChat} aria-label="New chat" style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', animation: 'hdrFade 0.24s ease' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 23, color: C.textIcon }}>edit_square</span>
        </button>
      )}
      {onOverflow && (
        <button key="overflow" onClick={onOverflow} aria-label="More options" style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: 'none', border: 'none', cursor: 'pointer', animation: 'hdrFade 0.24s ease' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 22, color: C.textIcon }}>more_vert</span>
        </button>
      )}
      {activeTab === 'plan' && dayFade && (dayFade.current || dayFade.incoming) && (() => {
        const label = (date) => {
          const { prefix, shortDate } = dayLabel(date)
          const lead = date === localDateStr() ? 'Today' : prefix
          return lead
            ? <><span style={{ fontSize: 16, fontWeight: 700, color: lead === 'Today' ? C.primary : C.textSecondary, letterSpacing: '-0.3px' }}>{lead}</span><span style={{ fontSize: 12, color: C.textTertiary }}>·</span><span style={{ fontSize: 16, fontWeight: 700, color: C.textSecondary, letterSpacing: '-0.3px' }}>{shortDate}</span></>
            : <span style={{ fontSize: 16, fontWeight: 700, color: C.textSecondary, letterSpacing: '-0.3px' }}>{shortDate}</span>
        }
        const layer = (date, opacity) => (
          <div key={date} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>{label(date)}</div>
          </div>
        )
        return <>
          {dayFade.current && layer(dayFade.current, dayFade.incoming ? 1 - dayFade.p : 1)}
          {dayFade.incoming && layer(dayFade.incoming, dayFade.p)}
        </>
      })()}
      {!hideTitle && activeTab !== 'careplan' && activeTab !== 'plan' && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div key={'t-' + (title || activeTab)} style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, lineHeight: 1.2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px', animation: 'hdrFade 0.24s ease' }}>{title || ({ careplan: 'Today', plan: 'Care plan', track: 'Tracker', chat: 'Chats', resources: 'Resources', community: 'Community', you: 'You' }[activeTab] || 'Today')}</div>
        </div>
      )}
    </div>
  )
}


// ─── CLINICAL EDIT SHEET ──────────────────────────────────────────
// Slides up when user taps Edit on an onboarding-seeded event card.
// Shows the question that created the event, pre-selects the current answer,
// Full-screen flow for editing a Clinical Detail event.
// Uses FlowShell (slide-up, confirm-on-dismiss) + FlowStack (horizontal push between steps).
const ClinicalEditSheet = ({ event, patientState, onSave, onClose }) => {
  const SOURCE_STEP = { seed_surgery: 'treatment_status', seed_pathology: 'treatment_status', seed_staging: 'stage' }
  const startKey = SOURCE_STEP[event?.id] || 'treatment_status'

  const cancerCode    = patientState?.onboardingAnswers?.cancer_type || patientState?.diagnosisCode || 'RCC'
  const selectedCancer = CANCER_TYPES.find(c => c.code === cancerCode) || CANCER_TYPES[CANCER_TYPES.length - 1]

  // Build ordered question sequence from startKey to end
  const seq = (() => {
    const s = []
    let cur = startKey
    while (cur !== 'done') {
      s.push(cur)
      if (cur === 'stage')          cur = cancerCode === 'RCC' ? 'histology' : 'treatment_status'
      else if (cur === 'histology') cur = 'treatment_status'
      else                          cur = 'done'
    }
    return s
  })()

  const hasFollowUp = seq.length > 1
  // Visual steps: q0 → (transition?) → q1 → q2…
  const totalSteps = hasFollowUp ? seq.length + 1 : 1

  const QUESTION_CONTENT = {
    stage: {
      title: `What stage is your ${selectedCancer?.name || 'cancer'}?`,
      hint:  "Your doctor will have described this after imaging or surgery. If you're not sure, choose the closest option.",
      key:   'stage',
      opts:  [
        { value: 'stage_1', label: 'Stage I',      sub: "Cancer is localised, hasn't spread" },
        { value: 'stage_2', label: 'Stage II',     sub: 'Cancer has grown but is still contained' },
        { value: 'stage_3', label: 'Stage III',    sub: 'Cancer has spread to nearby lymph nodes' },
        { value: 'stage_4', label: 'Stage IV',     sub: 'Cancer has spread to other organs' },
        { value: 'unsure',  label: "I'm not sure", sub: null },
      ],
    },
    histology: {
      title: 'What type of kidney cancer cell did your doctor mention?',
      hint:  'This is usually found in the pathology report after a biopsy or surgery.',
      key:   'histology',
      opts:  [
        { value: 'clear_cell', label: 'Clear cell',     sub: 'The most common type, about 75% of kidney cancers' },
        { value: 'non_clear',  label: 'Non-clear cell', sub: 'Papillary, chromophobe, or other type' },
        { value: 'unsure',     label: "I'm not sure or don't have a report yet", sub: null },
      ],
    },
    treatment_status: {
      title: 'Have you started treatment yet?',
      hint:  'This helps us show you the most relevant recommendations for where you are right now.',
      key:   'treatment_status',
      opts:  [
        { value: 'surgery', label: "Yes — I've had surgery",           sub: selectedCancer?.surgery ? `e.g. ${selectedCancer.surgery}` : 'A surgical procedure' },
        { value: 'other',   label: "Yes — I've had another treatment", sub: 'Radiation, ablation, or systemic therapy' },
        { value: 'no',      label: "No, treatment hasn't started yet", sub: null },
        { value: 'unsure',  label: "I'm not sure",                     sub: null },
      ],
    },
  }

  const initialAnswers = patientState?.onboardingAnswers || {}
  const [localAnswers, setLocalAnswers] = useState({ ...initialAnswers })

  // Only warn on dismiss if the user actually changed something (reverts count too)
  const hasChanges = seq.some(qKey => {
    const k = QUESTION_CONTENT[qKey].key
    return localAnswers[k] !== initialAnswers[k]
  })

  return (
    <FlowShell onClose={onClose} confirmClose={hasChanges} zIndex={300}>
      {(dismiss, setNav, reallyDismiss) => {
        const [step, setStep] = useState(0)

        // Visual step index → question key (or 'transition')
        const stepKey = (s) => {
          if (s === 0) return seq[0]
          if (hasFollowUp && s === 1) return 'transition'
          return seq[hasFollowUp ? s - 1 : s]
        }

        const isLastStep = step === totalSteps - 1

        // Back: only when not on the last/only step
        useEffect(() => {
          setNav({ title: 'Clinical Details', subtitle: null, onBack: step > 0 && !isLastStep ? () => setStep(s => s - 1) : null })
        }, [step])

        const handlePrimary = () => {
          if (isLastStep) {
            onSave(localAnswers)
          } else {
            setStep(s => s + 1)
          }
        }

        // Render options for a given question key
        const renderOpts = (qKey) => {
          const q = QUESTION_CONTENT[qKey]
          return q.opts.map(opt => {
            const sel = localAnswers[q.key] === opt.value
            return (
              <button key={opt.value}
                onClick={() => setLocalAnswers(prev => ({ ...prev, [q.key]: opt.value }))}
                style={{
                  width: '100%', padding: '14px 20px',
                  backgroundColor: sel ? C.primaryLight : C.bgCard,
                  border: `1.5px solid ${sel ? C.primary : C.border}`,
                  borderRadius: 13, cursor: 'pointer', textAlign: 'left',
                  fontSize: 15, fontWeight: 500, color: C.textPrimary,
                  marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontFamily: 'Inter,sans-serif',
                }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: opt.sub ? 2 : 0 }}>{opt.label}</div>
                  {opt.sub && <div style={{ fontSize: 13, color: C.textSecondary, fontWeight: 400 }}>{opt.sub}</div>}
                </div>
              </button>
            )
          })
        }

        // Build FlowStack step array
        const questionSteps = seq.map((qKey, qi) => {
          const visualIdx = hasFollowUp ? (qi === 0 ? 0 : qi + 1) : 0
          const isThisLast = visualIdx === totalSteps - 1
          const q = QUESTION_CONTENT[qKey]
          return () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, lineHeight: 1.3, marginBottom: 10 }}>{q.title}</div>
                <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>{q.hint}</div>
                {renderOpts(qKey)}
              </div>
              <DockedButton
                label={isThisLast ? 'Save' : 'Next'}
                onClick={handlePrimary}
                disabled={!localAnswers[q.key]}
              />
            </StepView>
          )
        })

        const transitionStep = () => (
          <StepView>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px 120px' }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 16, lineHeight: 1.3 }}>
                A couple more questions
              </div>
              <div style={{ fontSize: 16, color: C.textSecondary, lineHeight: 1.6 }}>
                Changing this detail may affect your recommendations. A few quick questions will keep them accurate.
              </div>
            </div>
            <DockedButton label="Continue" onClick={handlePrimary}/>
          </StepView>
        )

        const allSteps = hasFollowUp
          ? [questionSteps[0], transitionStep, ...questionSteps.slice(1)]
          : questionSteps

        return <FlowStack step={step} steps={allSteps} setNav={setNav}/>
      }}
    </FlowShell>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────
export default function App() {
  // Hydrate persisted state once — must be first so all useState can use it
  const _hydrated = hydrateState({
    patientState: INITIAL_PATIENT_STATE,
    timeline: INITIAL_TIMELINE,
    userDecisions: INITIAL_USER_DECISIONS,
  })
  const _hasSession = !!loadSession()
  // Onboarded = the record carries an onboarding date (new flow), or — for records from the
  // earlier onboarding — the timeline grew past the demo seed. (The event-count heuristic alone
  // misses new users: a fresh record has 1 diagnosis event, fewer than the demo seed's 6.)
  const _isOnboarded = !!(_hydrated.patientState && _hydrated.patientState.onboardedDate)
    || _hydrated.timeline.flatMap(d => d.events || []).length > INITIAL_TIMELINE.flatMap(d => d.events || []).length
  const [onboarded, setOnboarded] = useState(_isOnboarded)
  const [authVisible, setAuthVisible] = useState(!_isOnboarded || !_hasSession)
  const [revealedCards, setRevealedCards] = useState(new Set())
  const [generationDone, setGenerationDone] = useState(false)
  const [showTodayPill, setShowTodayPill] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0) // cards that have been revealed
  const justAddedRef = useRef(false) // set when the user adds an event, so the group-change replay yields to the add's own scroll/highlight
  const [genText, setGenText] = useState(null)                   // single updating status line
  const [genBlockId, setGenBlockId] = useState(null)              // which block is generating
  const [blockGenStates, setBlockGenStates] = useState({})       // idle | generating | generated
  const [summaryShown, setSummaryShown] = useState(false)        // false during the build; true inserts the Today summary card after the scroll-to-Today settles
  const [timeline, setTimeline] = useState(() => reconcileToday(_hydrated.timeline))
  const [userDecisions, setUserDecisions] = useState(_hydrated.userDecisions)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [flow, setFlow] = useState(null)
  const [toast, setToast] = useState(null)
  // ── redesign-01 record stores (persisted, additive) ──
  const [symptoms, setSymptoms] = useState(loadSymptoms)
  const [doseLogs, setDoseLogs] = useState(loadDoseLogs)
  const [journal, setJournal] = useState(loadJournal)
  const [pending, setPending] = useState(() => _normalizePending(loadPending()))
  const [questions, setQuestions] = useState(loadQuestions)
  const [aiDismissed, setAiDismissed] = useState(loadAiDismissed)
  const [mood, setMood] = useState(loadMood)
  const [symptomNone, setSymptomNone] = useState(loadSymptomNone)
  const [careSummaryOpen, setCareSummaryOpen] = useState(false)
  // Header collapse: non-Today tabs hide the glass bar on scroll-down, reveal on scroll-up.
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  // Dev: time-of-day atmosphere override (null = auto), persisted.
  const [todOverride, setTodOverrideState] = useState(() => { try { return localStorage.getItem('o4m_dev_tod') || null } catch { return null } })
  const setTodOverride = (v) => {
    try { v ? localStorage.setItem('o4m_dev_tod', v) : localStorage.removeItem('o4m_dev_tod') } catch {}
    setTodOverrideState(v)
  }
  const lastScrollTopRef = useRef(0)
  const [moodFlowOpen, setMoodFlowOpen] = useState(false)
  const [justCheckedLine, setJustCheckedLine] = useState(null)
  const [artifactAppt, setArtifactAppt] = useState(null)
  const [symptomFlowOpen, setSymptomFlowOpen] = useState(false)
  const [symptomFlowEntry, setSymptomFlowEntry] = useState(null)
  const [journalFlowOpen, setJournalFlowOpen] = useState(false)
  const [journalFlowEntry, setJournalFlowEntry] = useState(null)
  const [pendingFlowOpen, setPendingFlowOpen] = useState(false)
  const [doseLogOpen, setDoseLogOpen] = useState(false)
  const [confirmOutcome, setConfirmOutcome] = useState(null)
  const [teaserDetail, setTeaserDetail] = useState(null)
  const [askOpen, setAskOpen] = useState(false)
  const [askPrefill, setAskPrefill] = useState('')  // question carried over from chat
  const [chatOpen, setChatOpen] = useState(false)  // redesign-04: chat as a slide-up sheet
  const [chatContext, setChatContext] = useState(null)  // surface chat was opened from (seeds prompts)
  useEffect(() => { saveSymptoms(symptoms) }, [symptoms])
  useEffect(() => { saveDoseLogs(doseLogs) }, [doseLogs])
  useEffect(() => { saveJournal(journal) }, [journal])
  useEffect(() => { savePending(pending) }, [pending])
  useEffect(() => { saveQuestions(questions) }, [questions])
  useEffect(() => { saveAiDismissed(aiDismissed) }, [aiDismissed])
  useEffect(() => { saveMood(mood) }, [mood])
  useEffect(() => { saveSymptomNone(symptomNone) }, [symptomNone])
  const [dayFade, setDayFade] = useState({ current: null, incoming: null, p: 0 })
  const [highlightId, setHighlightId] = useState(null)
  const [todayFlash, setTodayFlash] = useState(false)
  const [treatmentOpt, setTreatmentOpt] = useState(null)
  const [summarizeBlock, setSummarizeBlock] = useState(null)
  const [activeTab, setActiveTab] = useState('careplan')
  const [tabDir, setTabDir] = useState(1)
  const [tabKey, setTabKey] = useState(0)
  const prevTabRef = useRef('careplan')
  const [showYou, setShowYou] = useState(false)
  const [chatMenuSignal, setChatMenuSignal] = useState(0)          // header hamburger → open history drawer
  const [chatNewSignal, setChatNewSignal] = useState(0)            // header compose → start a new chat
  const [chatBackSignal, setChatBackSignal] = useState(0)          // header back arrow → return to the home surface
  const [chatDrilled, setChatDrilled] = useState(false)            // true when a chat was opened from the side menu
  const [chatMenuOpen, setChatMenuOpen] = useState(false)          // true while the history menu is revealed (footer nav slides aside with the home)
  const [chatDrilledTitle, setChatDrilledTitle] = useState(null)   // current chat's topic title (null = fresh chat)
  const [chatOverflowOpen, setChatOverflowOpen] = useState(false)
  const [chatConfirmDelete, setChatConfirmDelete] = useState(false)
  const [chatDeleteSignal, setChatDeleteSignal] = useState(0)
  const [captureAck, setCaptureAck] = useState(null)      // {threadId, id, text} injected into the active chat thread
  const pendingCaptureRef = useRef(null)                  // {type, threadId} while a chat-initiated flow is open
  // Engagement nudge (feature-flagged, engagementModal): a manual event add OR a "Leave without
  // saving" abandon is a high-intent signal. Persisted gating (registerEngagementSignal) decides
  // when to show / re-show. Onboarding, system-generated, and chat-capture events don't count.
  const [engagementModalOpen, setEngagementModalOpen] = useState(false)
  const [recordsCardVisible, setRecordsCardVisible] = useState(shouldShowRecordsCard) // persistent timeline card
  const engagementShownThisSessionRef = useRef(false) // enforce once-per-session
  const flowJustCompletedRef = useRef(false)          // set on a save so the trailing onClose isn't miscounted as an abandon
  const signalEngagement = () => {
    if (exp('engagementModal') !== 'on') return
    if (registerEngagementSignal({ sessionShown: engagementShownThisSessionRef.current })) {
      engagementShownThisSessionRef.current = true
      // Wait a beat so the modal lands after the user feels they finished — never mid-action.
      setTimeout(() => setEngagementModalOpen(true), ENGAGEMENT_SHOW_DELAY_MS)
    }
  }
  // Dismissing the nudge without connecting drops a persistent "records not synced" card into the timeline.
  const dismissEngagementNudge = () => {
    setEngagementModalOpen(false)
    if (!areRecordsConnected()) { activateRecordsCard(); setRecordsCardVisible(true) }
  }
  // Connect from the nudge (simulated): mark connected — terminal for the nudge + the records card.
  const connectRecordsFromNudge = () => {
    markRecordsConnected()
    setEngagementModalOpen(false)
    setRecordsCardVisible(false)
    setToast({ message: 'Health records connected' })
  }
  const handleDismissRecordsCard = () => { dismissRecordsCard(); setRecordsCardVisible(false) }
  const [appReveal, setAppReveal] = useState(false)
  const [currentUser, setCurrentUser] = useState(loadSession)
  const [selectedCommunity, setSelectedCommunity] = useState(null)
  const [autoJoinedCommunity, setAutoJoinedCommunity] = useState(null)
  const [answerSheet, setAnswerSheet] = useState(null) // question key(s) for the one-tap gap sheet
  const [flowPreload, setFlowPreload] = useState(null)
  const [medications, setMedications] = useState(loadMedications)
  const [patientState, setPatientState] = useState(_hydrated.patientState)
  const sentinelRefs = useRef({})
  const planUpdateMessagesRef = useRef(null) // set by visibleRecs effect for mid-session plan updates
  const scrollRef = useRef(null)

  useEffect(() => {
    window.__openApproach = (opt) => setTreatmentOpt(typeof opt === 'string' ? { id: opt, title: opt } : opt)
    return () => { delete window.__openApproach }
  }, [])

  // Track which day sentinel is nearest to the top of the scroll container
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    // Scroll-driven cross-fade (v3.04). A date line starts fading the moment its top touches the
    // bottom of the floating buttons (y = 52, not the bottom of the fade), and is fully gone once
    // it's entirely behind them. The same progress fades that date in, centered, in the header,
    // while the previous day's centered date fades out.
    // v3.05: starts earlier. The fade begins while the date is still FADE_LEAD px below the
    // buttons' bottom edge and is complete once the date's top has reached that edge, so the
    // date is already gone as it slides behind the buttons.
    // v3.23: back to the v3.05 timing (completes at the buttons' bottom edge, y 52); the space under
    // the header is handled by DAY_TOP_OFFSET instead.
    const LINE = 52, FADE_LEAD = 16
    const recompute = () => {
      const top = root.getBoundingClientRect().top
      let current = null, incoming = null, p = 0
      root.querySelectorAll('[data-dayline]').forEach(el => {
        const r = el.getBoundingClientRect()
        const t = r.top - top
        const prog = Math.max(0, Math.min(1, (LINE + FADE_LEAD - t) / FADE_LEAD))
        el.style.opacity = String(1 - prog)
        if (prog >= 1) current = el.dataset.dayline
        else if (prog > 0) { incoming = el.dataset.dayline; p = prog }
      })
      setDayFade(prev => (prev.current === current && prev.incoming === incoming && Math.abs(prev.p - p) < 0.02) ? prev : { current, incoming, p })
    }
    root.addEventListener('scroll', recompute, { passive: true })
    const raf = requestAnimationFrame(recompute)
    return () => { cancelAnimationFrame(raf); root.removeEventListener('scroll', recompute) }
  }, [timeline])

  // New user — clear all state and run onboarding from blank slate
  const handleNewUser = () => {
    clearPersistedState()
    clearEngagementState()
    setTimeline([])
    setPatientState({})
    setUserDecisions(INITIAL_USER_DECISIONS)
    setMedications([])
    setOnboarded(false)
    setCurrentUser(null)
    setRecordsCardVisible(false)
    setPending([]); setMood([]); setSymptoms([]); setDoseLogs([]); setJournal([]); setSymptomNone([]); setQuestions([]); setAiDismissed([])
    engagementShownThisSessionRef.current = false
    setAuthVisible(false)
  }

  // Returning user — preserve any persisted state, skip onboarding
  const handleReturningUser = (user) => {
    setAuthVisible(false)
    setCurrentUser(user)
    // Rehydrate from storage in case a previous session left data
    const hydrated = hydrateState({
      patientState: INITIAL_PATIENT_STATE,
      timeline: INITIAL_TIMELINE,
      userDecisions: INITIAL_USER_DECISIONS,
    })
    setTimeline(reconcileToday(hydrated.timeline))
    setPatientState(hydrated.patientState)
    setUserDecisions(hydrated.userDecisions)
    setOnboarded(true)
    prevTabRef.current = 'careplan'
    setActiveTab('careplan')
  }

  const handleLogout = () => {
    logout()
    clearPersistedState()
    clearEngagementState()
    setCurrentUser(null)
    setAuthVisible(true)
    setOnboarded(false)
    setTimeline(INITIAL_TIMELINE)
    setPatientState(INITIAL_PATIENT_STATE)
    setUserDecisions(INITIAL_USER_DECISIONS)
    setMedications([])
    setRecordsCardVisible(false)
    setPending([]); setMood([]); setSymptoms([]); setDoseLogs([]); setJournal([]); setSymptomNone([]); setQuestions([]); setAiDismissed([])
    engagementShownThisSessionRef.current = false
  }

  const TAB_ORDER = ['careplan', 'plan', 'track', 'community'] // 'chat' is reachable via Ask O4M (not a nav tab); 'you' is an overlay
  const switchTab = (next) => {
    const from = TAB_ORDER.indexOf(prevTabRef.current)
    const to   = TAB_ORDER.indexOf(next)
    setTabDir(to >= from ? 1 : -1)
    setTabKey(k => k + 1)
    prevTabRef.current = next
    setActiveTab(next)
    if (next === 'community') setAutoJoinedCommunity(null)
  }
  // Open the chat sheet, seeding its prompts from the surface it was launched from.
  const openChat = () => {
    const map = { careplan: 'today', plan: 'careplan', track: 'track', community: 'community' }
    setChatContext(map[activeTab] || null)
    setChatOpen(true)
  }

  // Chat deep links — navigate to real screens where they exist, toast-stub the rest.
  // Chat steps back and dims while a flow it started (add flow, Ask O4M, the profile) is open over it.
  const chatCovered = chatOpen && (askOpen || showYou || !!flowPreload)
  const handleChatDeepLink = (target) => {
    // Main sections can't open over chat: chat slides down and the app goes there. Chat keeps its place,
    // so tapping Chat reopens the same conversation ("Where chat opens").
    if (target === 'careplan' || target === 'track' || target === 'community') { setChatOpen(false); switchTab(target); return }
    if (target === 'profile') { setShowYou(true); return }
    if (target === 'nurse') { setAskPrefill(''); setAskOpen(true); return }  // no live nurse chat: open Ask O4M
    const labels = {
      nurse:  'Opening Ask O4M…',
      trials: 'Opening the clinical trials finder…',
      mood:   'Opening the mood tracker…',
      'connect-records': 'Health records connected — I can use them in this chat now.',
      'add-portal': 'Connecting an additional provider portal…',
    }
    setToast({ message: labels[target] || 'Opening…' })
  }

  const completeOnboarding = ({ patientState: ps, seedEvents, user, onboardingMedications, matchedCommunity }) => {
    // Set the newly created user
    if (user) setCurrentUser(user)
    // Update patient state for recommendation engine
    if (ps) setPatientState(ps)

    // Seed matched community silently — store separately so it doesn't open the detail overlay
    if (matchedCommunity) setAutoJoinedCommunity(matchedCommunity)

    // Seed medications into tracker
    if (onboardingMedications && onboardingMedications.length > 0) {
      const trackerMeds = onboardingMedications.map(med => ({
        id: `med-onboard-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: med.name,
        subtitle: med.subtitle || '',
        startDate: localDateStr(),
        dose: '',
        notes: '',
        components: med.components || [],
      }))
      setMedications(trackerMeds)
    }

    // Build a fresh timeline from scratch — never merge into prev (stale closure risk)
    const todayStr = localDateStr()
    const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

    // Today's raw node carries no summary text — it's derived at render time in `timelineWithRecs`.
    const dayMap = {
      [todayStr]: { date: todayStr, label: todayLabel, isToday: true, summary: null, events: [], suggested: null }
    }

    // Place seed events into their respective day nodes
    const allSeedEvents = [...(seedEvents || [])]

    // Add medication events on today's date
    if (onboardingMedications && onboardingMedications.length > 0) {
      onboardingMedications.forEach(med => {
        allSeedEvents.push({
          date: todayStr,
          event: {
            id: `med-plan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'medication',
            name: med.name,
            date: todayStr,
            notes: '',
          }
        })
      })
    }

    if (allSeedEvents.length > 0) {
      for (const { date, event } of allSeedEvents) {
        if (!dayMap[date]) {
          const d = new Date(date + 'T12:00:00')
          const label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
          dayMap[date] = { date, label, isToday: date === todayStr, summary: null, events: [], suggested: null }
        }
        if (!dayMap[date].events.some(e => e.id === event.id)) {
          dayMap[date].events.push(event)
        }
      }
    }

    const freshTimeline = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))
    setTimeline(freshTimeline)

    setRevealedCards(new Set())
    setBlockGenStates({})
    setGenText(null)
    setGenBlockId(null)
    setGenerationDone(false)
    setSummaryShown(false)
    setRefreshKey(k => k + 1)
    setOnboarded(true)
    isOnboardingRef.current = true // next visibleRecs change is from onboarding seed — suppress it
    prevTabRef.current = 'careplan'
    setActiveTab('careplan')
    setAppReveal(true)
    setTimeout(() => setAppReveal(false), 600)
  }

  // Trigger sequential generation after onboarding completes
  useEffect(() => {
    if (!onboarded) return
    const runGeneration = async () => {
      if (!scrollRef.current) { setSummaryShown(true); return }
      const container = scrollRef.current
      const sleep = ms => new Promise(r => setTimeout(r, ms))

      // Wait for onboarding overlay to unmount AND the scroll container to be laid out.
      // On mobile the dvh viewport settles a frame or two after mount; measuring/scrolling before
      // then leaves the view mis-sized until an interaction (pull-to-refresh) forces a reflow.
      await sleep(600)
      await new Promise(res => {
        let tries = 0, lastH = -1, stable = 0
        const check = () => {
          const h = scrollRef.current ? scrollRef.current.clientHeight : 0
          if (h > 100 && h === lastH) stable++; else stable = 0
          lastH = h
          if (stable >= 2 || tries++ > 40) res()
          else requestAnimationFrame(check)
        }
        requestAnimationFrame(check)
      })

      // Build flat ordered list of all items across all days
      const items = []
      for (const day of timelineWithRecs) {
        if (day.summary) items.push({ key: `${day.date}-summary`, type: 'summary' })
        for (const ev of (day.events || [])) {
          items.push({ key: `${day.date}-${ev.id}`, type: 'event' })
        }
        for (const blk of (day.suggested || [])) {
          items.push({ key: `${day.date}-${blk.id}`, type: 'suggestion', blockId: blk.id })
        }
      }

      // The Today summary is absent during the build; it's inserted after the scroll to Today.
      const summaryItem = items.find(i => i.type === 'summary')
      setSummaryShown(false)

      for (const item of items) {
        if (item.type === 'summary') continue  // not part of the build walk; inserted after the scroll
        await sleep(30)

        if (item.type === 'suggestion') {
          // Reveal the card first so it has a real height before measuring
          setRevealedCards(prev => { const n = new Set(prev); n.add(item.key); return n })
          setGenBlockId(item.blockId)
          await sleep(50)
          // Build status messages — use plan-update messages if this was triggered by a mid-session change,
          // otherwise use personalised onboarding messages
          const overrideMsgs = planUpdateMessagesRef.current
          planUpdateMessagesRef.current = null // consume once

          const ps = patientState
          const diagDate = timeline.find(d => d.events?.some(e => e.type === 'diagnosis'))
          const surgEvent = timeline.flatMap(d => d.events || []).find(e => /nephrectomy|surgery|ablation/i.test(e.name || ''))
          const stageLabel = ps.stage === 'I' ? 'Stage I' : ps.stage === 'III' ? 'Stage III' : ps.stage === 'IV' ? 'Stage IV' : `Stage ${ps.stage}`
          const histLabel = ps.biomarkers?.histology === 'clear-cell' ? 'clear cell RCC' : 'RCC'
          const surgLabel = surgEvent ? surgEvent.name.replace(/\s*\(surgery\)/i, '').toLowerCase() : null
          const surgDate = surgEvent ? new Date(surgEvent.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

          const cancerName = {
            RCC: 'kidney cancer', BREAST: 'breast cancer', CRC: 'colorectal cancer',
            LUNG: 'lung cancer', PROS: 'prostate cancer', BLAD: 'bladder cancer',
            OV: 'ovarian cancer', LEUK: 'leukemia', LYMP: 'lymphoma', MM: 'multiple myeloma',
          }[patientState.diagnosisCode] || 'your cancer'

          const genMessages = overrideMsgs || [
            surgLabel && surgDate
              ? `Reviewing your ${surgDate} ${surgLabel}…`
              : `Reviewing your ${cancerName} history…`,
            `Checking ${stageLabel} ${cancerName} guidelines…`,
            `Building your personalised ${cancerName} plan…`,
          ]

          // Natural timing variance — not a metronome
          const timings = [620, 780, 700]
          for (let mi = 0; mi < genMessages.length; mi++) {
            setGenText(genMessages[mi])
            await sleep(timings[mi])
          }
          setGenText(null)
          setGenBlockId(null)
          await sleep(100)
          setBlockGenStates(prev => ({ ...prev, [item.blockId]: 'generated' }))
        }

        // Reveal card (suggestions already revealed during generation; summary is deferred)
        if (item.type !== 'suggestion') {
          setRevealedCards(prev => {
            const n = new Set(prev)
            n.add(item.key)
            return n
          })
        }

        // Scroll newly revealed card into view
        await sleep(30)
        const el = container.querySelector(`[data-cardkey="${item.key}"]`)
        if (el) {
          const rect = el.getBoundingClientRect()
          const cRect = container.getBoundingClientRect()
          if (rect.bottom > cRect.bottom - 20) {
            container.scrollBy({ top: rect.bottom - cRect.bottom + 40, behavior: 'smooth' })
          }
        }

        await sleep(60)
      }

      // Everything else has generated. Scroll to Today, and right after the scroll settles, insert
      // the summary card at the top of Today — it pushes the events/recommendations below it down.
      scrollToToday()
      await sleep(550) // let the smooth scroll settle first
      if (summaryItem) setRevealedCards(prev => { const n = new Set(prev); n.add(summaryItem.key); return n })
      setSummaryShown(true)
      // Re-pin after the summary insert (and any late mobile viewport settle) so Today lands flush.
      await sleep(150)
      scrollToToday()
    }
    runGeneration()
    // Mark generation done after all cards have had time to appear
    // (estimated: ~50ms * numCards + suggestion delays)
    setTimeout(() => setGenerationDone(true), 8000)
  }, [onboarded, refreshKey])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = () => {
      // Show the "Today" control whenever today's header has moved off its resting position at the
      // top of the timeline — in EITHER direction (up into the past, or down into the future / its
      // own content). Keyed only on today's own sentinel vs the top edge, so it triggers
      // symmetrically and doesn't depend on another day climbing to the top (which a side with less
      // than a screen of content could never do). Position-based, no scroll-direction logic → no
      // flicker. 2px deadband avoids jitter at the resting position.
      const el = sentinelRefs.current[(timelineWithRecs.find(d => d.isToday) || {}).date]
      if (!el) return
      const cTop = container.getBoundingClientRect().top
      const offset = el.getBoundingClientRect().top - cTop
      setShowTodayPill(Math.abs(offset - DAY_TOP_OFFSET) > 2)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [onboarded])

  // Persist state changes to localStorage
  useEffect(() => { savePatientState(patientState) }, [patientState])
  useEffect(() => { saveMedications(medications) }, [medications])
  useEffect(() => { saveTimeline(timeline) }, [timeline])
  useEffect(() => { saveUserDecisions(userDecisions) }, [userDecisions])

  const handleSaveMedication = (record) => {
    setMedications(prev => [record, ...prev])
  }

  const scrollToToday = () => {
    const container = scrollRef.current
    if (!container) return
    const todayDay = timelineWithRecs.find(d => d.isToday)
    if (!todayDay) return
    const el = sentinelRefs.current[todayDay.date]
    if (!el) return
    // Rect-based: measure the sentinel's live position relative to the container's
    // visible top edge and scroll by exactly that delta. This reflects the current
    // layout (fixed header, sticky day strips, the container's translateX transform,
    // and the mobile browser toolbar state) rather than a static offsetTop sum, so
    // the "Today · date" strip lands flush against the visible top on every device.
    const cRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const target = container.scrollTop + (elRect.top - cRect.top) - DAY_TOP_OFFSET
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    // Hide immediately — scroll event won't fire until movement starts
    setShowTodayPill(false)
  }

  // "Explore treatment options" (summary Plan-quiet state) → scroll to the first recommendation
  // block, and always pulse it so the tap gives feedback even when the block is already in view.
  const scrollToRecs = () => {
    const container = scrollRef.current
    const el = container && container.querySelector('[data-recs="1"]')
    if (!container || !el) return
    const cRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const inView = elRect.top >= cRect.top + 76 && elRect.bottom <= cRect.bottom
    if (!inView) {
      const target = container.scrollTop + (elRect.top - cRect.top) - 76  // clear of the floating header (v3.22)
      container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    }
    // Subtle gray wash behind the block's content (same idea as the new-event highlight, quieter and
    // neutral). A rounded overlay sits behind the content, so it shows through the header/gaps and is
    // hidden behind the opaque explain card + options, then fades to transparent. Nothing moves.
    const block = el.firstElementChild
    if (block && block.animate) {
      const prevPos = block.style.position, prevZ = block.style.zIndex
      block.style.position = 'relative'
      block.style.zIndex = '0'
      // Expanded → gray fades to transparent down the block (recedes behind the explain card +
      // options). Collapsed → solid gray wash over the single card.
      const expanded = block.children.length > 1
      const ov = document.createElement('div')
      ov.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;border-radius:13px;pointer-events:none;z-index:-1'
      ov.style.background = expanded ? 'linear-gradient(to bottom, #EAEAEE 0%, rgba(234,234,238,0) 70%)' : '#EAEAEE'
      block.appendChild(ov)
      const anim = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1400, easing: 'ease-out', delay: inView ? 0 : 260, fill: 'forwards' })
      anim.onfinish = () => { ov.remove(); block.style.position = prevPos; block.style.zIndex = prevZ }
    }
  }

  // Reset the "just completed" guard on every fresh open, so a previous save's flag can't
  // bleed into the next flow and swallow its abandon signal.
  const openFlow = (type) => { flowJustCompletedRef.current = false; setSheetOpen(false); setTimeout(() => setFlow(type), 310) }

  // Close a FAB add-flow. Reaching here means a type was selected (the flow was opened); closing
  // it without saving is the abandon signal — no confirm dialog required. Chat-capture excluded.
  // (The "Leave without saving" confirm still only appears once there's actual input; it's a
  // separate concern from the signal.)
  const closeAddFlow = () => {
    const wasCapture = !!pendingCaptureRef.current
    if (!wasCapture && !flowJustCompletedRef.current) {
      signalEngagement()
    }
    flowJustCompletedRef.current = false
    pendingCaptureRef.current = null
    setFlow(null); setFlowPreload(null)
  }

  // Chat-initiated capture: open the existing add-flow prefilled; handleComplete routes the result back to chat.
  const openCaptureFlow = ({ type, prefill, threadId, msgIndex, answer }) => {
    flowJustCompletedRef.current = false
    pendingCaptureRef.current = { type, threadId, msgIndex, answer }
    let item = prefill || null
    if (type === 'medication' && prefill && prefill.name) {
      const match = getMedicationCatalog().find(m => (m.name || '').toLowerCase() === prefill.name.toLowerCase())
      item = match || prefill
    }
    setFlowPreload({ type, item })
    setFlow(type)
  }

  const removeEvent = (eventId, dayDate) => {
    // Convenience sync: deleting a medication event also removes its linked tracker entry
    // (captured meds share an id across timeline + tracker). No-op for non-med events.
    const srcDay = timeline.find(d => d.date === dayDate)
    const srcEv = srcDay?.events?.find(e => e.id === eventId)
    const trackedMed = srcEv && srcEv.type === 'medication' ? medications.find(m => m.id === eventId) : null
    if (trackedMed) setMedications(prev => prev.filter(m => m.id !== eventId))
    setTimeline(prev => {
      const day = prev.find(d => d.date === dayDate)
      const ev = day?.events?.find(e => e.id === eventId)
      const origIdx = day?.events?.findIndex(e => e.id === eventId) ?? -1
      const typeLabel = ev?.type === 'appointment' ? 'Appointment'
        : ev?.type === 'scan'      ? 'Scan'
        : ev?.type === 'procedure' ? 'Procedure'
        : ev?.type === 'medication' ? 'Medication'
        : 'Event'
      setToast({
        message: `${typeLabel} removed`,
        action: ev ? {
          label: 'Undo',
          onAction: () => {
            setTimeline(current => {
              const idx = current.findIndex(d => d.date === dayDate)
              if (idx >= 0) {
                return current.map((d, i) => i === idx ? { ...d, events: [...d.events.slice(0, origIdx), ev, ...d.events.slice(origIdx)] } : d)
              }
              const d = new Date(dayDate + 'T12:00:00')
              return [...current, { date: dayDate, label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }), isToday: dayDate === localDateStr(), summary: null, events: [ev], suggested: null }].sort((a, b) => a.date.localeCompare(b.date))
            })
            if (trackedMed) setMedications(prev => prev.some(m => m.id === trackedMed.id) ? prev : [trackedMed, ...prev])
            setHighlightId(ev.id)
            setTimeout(() => setHighlightId(null), 3600)
          }
        } : null
      })
      return prev
        .map(day => day.date === dayDate
          ? { ...day, events: day.events.filter(e => e.id !== eventId) }
          : day
        )
        .filter(day => day.events.length > 0 || day.summary || day.isToday)
    })
  }

  const [clinicalEditEvent, setClinicalEditEvent] = useState(null)

  // Answers from the one-tap gap sheet (or the diagnosis card's Edit): rebuild the patient
  // state from the full answer set, keep the onboarding date, and update the diagnosis event
  // in place. Gaps are derived from the answers, so the answered gap disappears everywhere.
  const applyAnswers = (newAnswers) => {
    const { patientState: newPs, seedEvents } = buildPatientStateFromAnswers(newAnswers, { ...recordFacts(patientState), addedDate: localDateStr() })
    setPatientState(newPs)
    const dx = seedEvents.find(se => se.event.id === 'seed_diag')
    if (dx) {
      setTimeline(prev => prev.map(day => ({ ...day, events: day.events.map(e => e.id === 'seed_diag' ? { ...e, name: dx.event.name, details: dx.event.details } : e) })))
    }
    setAnswerSheet(null)
    setToast({ message: 'Your plan is updated', subtext: 'Thanks — that sharpens your next steps' })
  }

  const applyClinicalEdit = (newAnswers) => {
    const { patientState: newPs, seedEvents: newSeeds } = buildPatientStateFromAnswers(newAnswers, recordFacts(patientState))
    setPatientState(newPs)
    const todayStr = localDateStr()
    setTimeline(prev => {
      // Strip all non-diagnosis onboarding events, then re-add new ones
      let updated = prev
        .map(day => ({ ...day, events: day.events.filter(e => !(e.source === 'onboarding' && e.type !== 'diagnosis')) }))
        .filter(day => day.events.length > 0 || day.summary || day.isToday)
      for (const { date, event } of newSeeds) {
        if (event.type === 'diagnosis') continue
        const idx = updated.findIndex(d => d.date === date)
        if (idx >= 0) {
          if (!updated[idx].events.some(e => e.id === event.id))
            updated = updated.map((d, i) => i === idx ? { ...d, events: [...d.events, event] } : d)
        } else {
          const d = new Date(date + 'T12:00:00')
          updated = [...updated, { date, label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }), isToday: date === todayStr, summary: null, events: [event], suggested: null }]
          updated.sort((a, b) => a.date.localeCompare(b.date))
        }
      }
      return updated
    })
    setClinicalEditEvent(null)
    setToast({ message: 'Clinical profile updated', subtext: 'Edit anytime from Profile → Clinical Details' })
  }

  const handleComplete = (event) => {
    justAddedRef.current = true // the group-change replay should yield to this add's scroll/highlight
    // A manual add is a high-intent signal, unless it's a chat-initiated capture (excluded).
    if (!pendingCaptureRef.current) { flowJustCompletedRef.current = true }
    const dateKey = event.date || event.startDate || localDateStr()
    setTimeline(prev => {
      const existing = prev.find(d => d.date === dateKey)
      if (existing) return prev.map(d => d.date === dateKey ? { ...d, events: [...d.events, event] } : d)
      const d = new Date(dateKey + 'T12:00:00')
      return [...prev, { date: dateKey, label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }), isToday: false, summary: null, events: [event], suggested: null }].sort((a, b) => a.date.localeCompare(b.date))
    })
    // Record accepted decisions for any recommendations that match this event name
    const matchedRecs = findMatchingRules(event.name)
    if (matchedRecs.length > 0) {
      setUserDecisions(prev => [
        ...prev,
        ...matchedRecs
          .filter(r => !prev.some(d => d.recommendationId === r.id))
          .map(r => ({ id: `dec_${r.id}_${Date.now()}`, recommendationId: r.id, decision: 'accepted', timestamp: Date.now() }))
      ])
    }
    // Chat-initiated capture: dual-write where needed, return to chat with an acknowledgment, skip the care-plan scroll.
    const cap = pendingCaptureRef.current
    if (cap) {
      pendingCaptureRef.current = null
      setFlowPreload(null)
      setFlow(null)
      if (cap.type === 'medication') {
        handleSaveMedication({ id: event.id, name: event.name, dose: event.dose, startDate: event.startDate, endDate: event.endDate, notes: event.notes })
      }
      setCaptureAck({ threadId: cap.threadId, id: Date.now(), text: buildCaptureAck(cap.type, event), msgIndex: cap.msgIndex, answer: cap.answer })
      return
    }
    setFlow(null)
    // Scroll to the newly added event, then highlight it.
    // Two things must be true before we scroll: (1) the card exists — a future-dated
    // event mounts a whole new day section further down, so poll for it; (2) the layout
    // has settled. When adding from a recommendation, the treatment overlay is sliding
    // closed and the feed height is mid-change from 100dvh (drill-in open, extends under
    // the nav) to calc(100dvh - 132px). Scrolling during that window lands the card
    // behind the nav and the moving scroll gets interrupted when the height snaps. So we
    // wait for the card, then wait out the close transition, then scroll exactly once.
    const targetKey = `${dateKey}-${event.id}`
    const fireHighlight = () => {
      setHighlightId(event.id)
      setTimeout(() => setHighlightId(null), 3600)
      setTodayFlash(true)
      setTimeout(() => setTodayFlash(false), 900)
    }
    let tries = 0
    const waitForCard = () => {
      const c = scrollRef.current
      const el = c && c.querySelector(`[data-cardkey="${targetKey}"]`)
      if (el && c) {
        // Card is mounted — let overlays finish closing / feed height settle, then scroll once.
        setTimeout(() => {
          const target = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 80
          c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
          fireHighlight()
        }, 380)
      } else if (tries++ < 90) {
        requestAnimationFrame(waitForCard)
      } else {
        fireHighlight()
      }
    }
    requestAnimationFrame(waitForCard)
    if (!pendingCaptureRef.current) signalEngagement() // delay handled inside (ENGAGEMENT_SHOW_DELAY_MS)
  }

  // ── redesign-01 handlers: writers → the record, action-item dispatch, artifact ──
  const writeToTimeline = (event) => {
    const dateKey = event.date || localDateStr()
    setTimeline(prev => {
      const existing = prev.find(d => d.date === dateKey)
      if (existing) return prev.map(d => d.date === dateKey ? { ...d, events: [...d.events, event] } : d)
      const d = new Date(dateKey + 'T12:00:00')
      return [...prev, { date: dateKey, label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }), isToday: dateKey === localDateStr(), summary: null, events: [event], suggested: null }].sort((a, b) => a.date.localeCompare(b.date))
    })
  }
  const _pop = (line) => { setJustCheckedLine(line); setTimeout(() => setJustCheckedLine(l => l === line ? null : l), 500) }
  const logMood = (entry) => {
    setMood(prev => [...prev, entry])
    setMoodFlowOpen(false); _pop('mood'); setToast({ message: 'Mood logged' })
  }
  const symptomNoneToday = () => {
    const t = localDateStr()
    setSymptomNone(prev => prev.includes(t) ? prev : [...prev, t])
    _pop('symptoms'); setToast({ message: 'Noted — nothing to report' })
  }
  const logSymptom = (entry) => {
    setSymptoms(prev => { const i = prev.findIndex(e => e.id === entry.id); if (i >= 0) { const next = [...prev]; next[i] = entry; return next } return [...prev, entry] })
    setSymptomFlowOpen(false); setSymptomFlowEntry(null); _pop('symptoms')
    setToast({ message: 'Symptom logged', subtext: 'Added to your record' })
  }
  const logJournal = (entry) => {
    setJournal(prev => { const i = prev.findIndex(e => e.id === entry.id); if (i >= 0) { const next = [...prev]; next[i] = entry; return next } return [...prev, entry] })
    setJournalFlowOpen(false); setJournalFlowEntry(null); _pop('journal')
    setToast({ message: 'Journal entry saved' })
  }
  const logDose = (entry) => {
    setDoseLogs(prev => [...prev, entry])
    if (entry.status === 'skipped') writeToTimeline({ id: entry.id, type: 'dose', name: `Skipped ${entry.medName}`, date: entry.date, notes: entry.reason })
    setDoseLogOpen(false)
    setToast({ message: entry.status === 'skipped' ? 'Skipped dose logged' : 'Dose logged' })
  }
  const addPending = (entry) => {
    setPending(prev => [...prev, entry])
    setPendingFlowOpen(false)
    setToast({ message: 'Added to your next steps' })
  }
  const startNextStep = (id) => {
    const p = pending.find(x => x.id === id)
    setPending(prev => prev.map(x => x.id === id ? { ...x, state: 'awaiting', startedDate: localDateStr() } : x))
    const msg = p?.kind === 'records' ? 'Connecting your records…' : p?.kind === 'trial' ? 'Added to your visit prep' : "Started — we'll update you when it's ready"
    setToast({ message: msg })
  }
  const resolveNextStep = (id, note) => {
    setPending(prev => prev.map(x => x.id === id ? { ...x, state: 'resolved', resolvedDate: localDateStr(), outcome: note || '' } : x))
    setConfirmOutcome(null)
    setToast({ message: 'Marked done' })
  }
  const upcomingAppt = useMemo(() => {
    const t = localDateStr()
    const appts = (timeline || []).flatMap(d => (d.events || []).filter(e => e.type === 'appointment' && (e.date || d.date) > t).map(e => ({ ...e, date: e.date || d.date })))
    return appts.sort((a, b) => a.date.localeCompare(b.date))[0] || null
  }, [timeline])
  // ── redesign-02: daily check-in state + one-time to-dos ──
  const checkinState = useMemo(() => {
    const t = localDateStr()
    return {
      mood: mood.some(m => m.date === t),
      symptoms: symptoms.some(s => s.date === t) ? 'logged' : (symptomNone.includes(t) ? 'none' : null),
      journal: journal.some(j => j.date === t),
    }
  }, [mood, symptoms, symptomNone, journal])
  const checkinSymptomEntry = useMemo(() => { const t = localDateStr(); return symptoms.filter(x => x.date === t).slice(-1)[0] || null }, [symptoms])
  const checkinJournalEntry = useMemo(() => { const t = localDateStr(); return journal.filter(j => j.date === t).slice(-1)[0] || null }, [journal])
  const checkinMoodLabel = useMemo(() => {
    const t = localDateStr()
    const m = [...mood].reverse().find(x => x.date === t)
    return m?.label || null
  }, [mood])
  // Gentle accumulation count — distinct days with any check-in activity; never resets, no streak pressure
  const checkinCount = useMemo(() => {
    const s = new Set()
    mood.forEach(m => m.date && s.add(m.date))
    symptoms.forEach(x => x.date && s.add(x.date))
    journal.forEach(j => j.date && s.add(j.date))
    symptomNone.forEach(d => s.add(d))
    return s.size
  }, [mood, symptoms, journal, symptomNone])
  const todos = useMemo(() => [...deriveTodos({ pending, upcomingAppt }), ...deriveQuestionGaps(patientState.onboardingAnswers)], [pending, upcomingAppt, patientState.onboardingAnswers])
  const onTodoAction = (item) => {
    if (item.state === 'question') { setAnswerSheet(item.question); return }
    if (item.kind === 'prepare-visit') { setArtifactAppt(item.appt); return }
    if (item.state === 'todo') { startNextStep(item.id); return }
    if (item.state === 'awaiting') { setConfirmOutcome(item) } // only confirm-kind awaiting renders a button
  }
  // Authoritative-signal resolution: records/genomic awaiting for ≥1 day resolve on load
  // (the dev day-rollover stands in for records syncing / results arriving).
  useEffect(() => {
    const t = localDateStr()
    let changed = false
    const next = pending.map(p => {
      if (p.state === 'awaiting' && (p.kind === 'records' || p.kind === 'genomic') && p.startedDate && _daysBetweenStr(p.startedDate, t) >= 1) { changed = true; return { ...p, state: 'resolved', resolvedDate: t } }
      return p
    })
    if (changed) { setPending(next); setTimeout(() => setToast({ message: 'A next step resolved', subtext: 'Records synced or results arrived' }), 500) }
  }, []) // on load

  // Derive recommendations, addedIds, and allPlanItems from current state
  const { allPlanItems, visibleRecs, addedIds } = useRecommendations(patientState, timeline)
  const summaryTeasers = useMemo(() => buildTeasers({ symptoms, mood, doseLogs, pending, upcomingAppt, visibleRecs }), [symptoms, mood, doseLogs, pending, upcomingAppt, visibleRecs])
  const onTeaserAction = (t) => {
    if (t.type === 'ready-to-share' && upcomingAppt) { setArtifactAppt(upcomingAppt); return }
    setTeaserDetail(t)
  }
  const _recsForSummary = visibleRecs && visibleRecs.length ? visibleRecs : null
  const treatmentBasis = useMemo(() => buildTreatmentBasis(patientState, timeline), [patientState, timeline])
  const todaySummary = { bullets: buildDailySummary(patientState, timeline, _recsForSummary), narrative: buildSummaryNarrative(patientState, timeline, _recsForSummary) }
  const anyDrillInOpen = !!(treatmentOpt || selectedCommunity || showYou || summarizeBlock || flow || sheetOpen)
  // Drilled into a chat (back button showing) → treat like a drill-in: hide the fixed nav, go full-height.
  const hideNav = anyDrillInOpen || (activeTab === 'chat' && chatDrilled)   // hide the footer nav only when drilled into a chat from the side menu

  // Days that have check-in entries but no clinical event must still appear (so a day you only
  // logged mood/journal on still exists on the timeline). Derived, not stored.
  const _checkinDates = new Set()
  mood.forEach(m => m.date && _checkinDates.add(m.date))
  symptoms.forEach(x => x.date && _checkinDates.add(x.date))
  journal.forEach(j => j.date && _checkinDates.add(j.date))
  symptomNone.forEach(d => _checkinDates.add(d))
  const _todayStr2 = localDateStr()
  const _byDate = new Map(timeline.map(d => [d.date, d]))
  _checkinDates.forEach(date => {
    if (date === _todayStr2 || _byDate.has(date)) return
    const dd = new Date(date + 'T12:00:00')
    _byDate.set(date, { date, label: dd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }), isToday: false, summary: null, events: [], suggested: null })
  })
  const augmentedTimeline = Array.from(_byDate.values()).sort((a, b) => a.date.localeCompare(b.date))

  // Inject visible recommendations into today's day — derived, not stored
  const timelineWithRecs = augmentedTimeline.map(day => {
    if (!day.isToday) return day
    const recs = visibleRecs.length > 0 ? visibleRecs : null
    return { ...day, suggested: recs, summary: { bullets: buildDailySummary(patientState, timeline, recs), narrative: buildSummaryNarrative(patientState, timeline, recs) } }
  })

  // redesign-04: when the care plan opens (view → timeline), anchor to today — the scroll
  // container had no layout to anchor against while off-screen.
  useEffect(() => {
    if (activeTab !== 'plan') return
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => {
      const container = scrollRef.current
      if (!container) return
      const todayDay = timelineWithRecs.find(d => d.isToday)
      const el = todayDay && sentinelRefs.current[todayDay.date]
      if (!el) return
      const cRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      container.scrollTo({ top: Math.max(0, container.scrollTop + (elRect.top - cRect.top) - DAY_TOP_OFFSET), behavior: 'auto' })
    }))
    return () => cancelAnimationFrame(r1)
  }, [activeTab])

  // When recommendation groups change mid-session, replay the generation animation
  // so the user sees their plan being "redesigned" with contextual status messages.
  const prevRecGroupsRef = useRef(null)
  const isOnboardingRef = useRef(true) // suppress during initial onboarding render
  useEffect(() => {
    const current = visibleRecs.map(g => g.group).sort().join(',')
    const prev = prevRecGroupsRef.current
    // Consume the "user just added" flag for this render's derivation.
    const wasUserAdd = justAddedRef.current
    justAddedRef.current = false

    // First render after mount — just record, don't animate
    if (prev === null) {
      prevRecGroupsRef.current = current
      return
    }

    // Groups unchanged — nothing to do
    if (prev === current) return

    prevRecGroupsRef.current = current

    // The change was caused by the user adding an event. handleComplete already scrolls to
    // and highlights that new event; replaying the generation here would reset the reveal
    // state (re-hiding the new card and its "Added" tag) and scroll back to today, fighting
    // the add. So yield: the recommendations still update in place, just without the replay.
    if (wasUserAdd) return

    // Suppress the animation triggered by onboarding completion itself
    // (completeOnboarding increments refreshKey which already runs the full sequence)
    if (isOnboardingRef.current) {
      isOnboardingRef.current = false
      return
    }

    // A real mid-session plan change — figure out what changed for contextual messages
    const prevGroups = prev ? prev.split(',') : []
    const currGroups = current ? current.split(',') : []
    const appeared = visibleRecs.filter(g => !prevGroups.includes(g.group))
    const disappeared = currGroups.length === 0 ? [] : prevGroups.filter(g => !currGroups.includes(g))

    const newGroupLabel = appeared[0]?.stepLabel || null
    const removedGroupLabel = disappeared.length > 0
      ? (timelineWithRecs.find(d => d.isToday)?.suggested || []).find(g => disappeared.includes(g.group))?.stepLabel || 'previous recommendations'
      : null

    const cancerName = {
      RCC: 'kidney cancer', BREAST: 'breast cancer', CRC: 'colorectal cancer',
      LUNG: 'lung cancer', PROS: 'prostate cancer', BLAD: 'bladder cancer',
      OV: 'ovarian cancer', LEUK: 'leukemia', LYMP: 'lymphoma', MM: 'multiple myeloma',
    }[patientState.diagnosisCode] || 'your cancer'

    const updateMessages = newGroupLabel
      ? [
          `Updating your ${cancerName} plan…`,
          `Applying ${newGroupLabel} guidelines…`,
          `Rebuilding your recommendations…`,
        ]
      : removedGroupLabel
      ? [
          `Updating your ${cancerName} plan…`,
          `Recalculating treatment phase…`,
          `Rebuilding your recommendations…`,
        ]
      : [
          `Updating your ${cancerName} plan…`,
          `Rechecking clinical guidelines…`,
          `Rebuilding your recommendations…`,
        ]

    // Reset generation state — cards hide, then replay the sequence
    setRevealedCards(new Set())
    setBlockGenStates({})
    setGenText(null)
    setGenBlockId(null)
    setGenerationDone(false)
    setSummaryShown(false)

    // Scroll to today first, then let the generation sequence play out
    setTimeout(() => {
      const todayDay = timelineWithRecs.find(d => d.isToday)
      if (todayDay) {
        const el = sentinelRefs.current[todayDay.date]
        if (el && scrollRef.current) {
          const c = scrollRef.current
          let offsetTop = 0; let node = el
          while (node && node !== c) { offsetTop += node.offsetTop; node = node.offsetParent }
          c.scrollTo({ top: Math.max(0, offsetTop - DAY_TOP_OFFSET), behavior: 'smooth' })
        }
      }
    }, 100)

    // Store messages where the generation useEffect can read them
    planUpdateMessagesRef.current = updateMessages
    setRefreshKey(k => k + 1)
  }, [visibleRecs])

  // ── Mobile keyboard (chat tab only) ───────────────────────────────
  // dvh doesn't shrink when the iOS keyboard opens, so the shell ends up taller than what's visible
  // and the composer gets pushed behind the keyboard. On the chat tab we shrink the shell to
  // visualViewport.height so the composer stays above the keyboard.
  // CRITICAL: write the height straight to the DOM, NOT via React state. setState on every
  // keyboard-animation frame re-renders the chat subtree and iOS drops the input's focus, which
  // dismisses the keyboard and causes the focus/blur loop. Direct DOM writes avoid re-rendering.
  const rootRef = useRef(null)
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  // Pin the shell to the VISIBLE viewport on the chat tab: height = visualViewport.height,
  // translateY = visualViewport.offsetTop, so the composer sits on top of the keyboard.
  // Height/transform are written straight to the DOM (no setState → no re-render → no focus loop),
  // and re-applied after every render (useLayoutEffect) so a nav-hide re-render can't clobber them.
  // kbOpen is the only state — it flips once per keyboard show/hide (guarded) to hide the nav.
  const kbOpenRef = useRef(false)
  const [kbOpen, setKbOpen] = useState(false)
  const applyShellHeight = useCallback(() => {
    const el = rootRef.current
    const vv = window.visualViewport
    const chat = activeTabRef.current === 'chat'
    if (el) {
      el.style.height = (chat && vv) ? `${vv.height}px` : '100dvh'
      el.style.transform = (chat && vv) ? `translateY(${vv.offsetTop}px)` : ''
    }
    const open = !!(chat && vv && (window.innerHeight - vv.height > 150))
    if (open !== kbOpenRef.current) { kbOpenRef.current = open; setKbOpen(open) }
  }, [])
  useLayoutEffect(() => { applyShellHeight() })
  useEffect(() => {
    const vv = window.visualViewport
    if (vv) { vv.addEventListener('resize', applyShellHeight); vv.addEventListener('scroll', applyShellHeight) }
    return () => { if (vv) { vv.removeEventListener('resize', applyShellHeight); vv.removeEventListener('scroll', applyShellHeight) } }
  }, [applyShellHeight])
  // Lock the page from scrolling while on the chat tab so iOS can't rubber-band the body (which
  // oscillates visualViewport.offsetTop and fights the pin). Only the message list scrolls, inside.
  useEffect(() => {
    document.body.style.overflow = activeTab === 'chat' ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [activeTab])
  // Capture-phase scroll handler on the content region: whichever screen is scrolling,
  // collapse the header on scroll-down past 56px, reveal on scroll-up or near the top.
  // Today (careplan) has a transparent floating header and never collapses.
  const handleContentScroll = (e) => {
    return  // floating header: never collapses (v3.02)
    const el = e.target
    if (!el || typeof el.scrollTop !== 'number') return
    const y = el.scrollTop, last = lastScrollTopRef.current
    if (y > last + 3 && y > 56) setHeaderCollapsed(true)
    else if (y < last - 3 || y <= 4) setHeaderCollapsed(false)
    lastScrollTopRef.current = y
  }
  useEffect(() => { setHeaderCollapsed(false); lastScrollTopRef.current = 0 }, [activeTab])

  // One subject for all patient copy (services/patientCopy.js)
  const patientCopySubject = useMemo(() => careSubject(patientState), [patientState.role, patientState.patientName, patientState.relationship])
  return (
    <PatientCopyContext.Provider value={patientCopySubject}>
    <>
    <style>{`@keyframes flyoutIn { from { opacity:0; transform:scale(0.88) translateY(-6px); } to { opacity:1; transform:scale(1) translateY(0); } } @keyframes o4mCheckPop { 0% { transform:scale(0.4); } 60% { transform:scale(1.15); } 100% { transform:scale(1); } } @keyframes o4mSpin { to { transform: rotate(360deg); } }`}</style>
    {/* CSS-owned app shell: root is a flex column pinned to the dynamic viewport. Header and
        nav are ordinary flex children (not position:fixed), and the active screen is the single
        flex:1 scroll owner. No per-panel height math; the browser divides 100dvh across the three. */}
    <div ref={rootRef} style={{ width: '100%', height: '100dvh', backgroundColor: C.bgApp, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {onboarded && activeTab !== 'chat' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 36, transform: headerCollapsed && activeTab !== 'careplan' ? 'translateY(-100%)' : 'translateY(0)', opacity: anyDrillInOpen ? 0 : 1, pointerEvents: anyDrillInOpen ? 'none' : 'auto', transition: 'transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease' }}>
            <AppHeader dayFade={activeTab === 'plan' ? dayFade : null} activeTab={activeTab} onProfileTap={() => setShowYou(true)} onAsk={openChat}/>
          </div>
        )}
        {/* Content region — single flex:1 area; the active screen fills it and scrolls internally */}
        <div onScrollCapture={handleContentScroll} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: activeTab === 'track' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
          <TrackScreen medications={medications} patientState={patientState} onSaveMedication={handleSaveMedication} symptoms={symptoms} journal={journal} onOpenSymptomFlow={() => setSymptomFlowOpen(true)} onOpenJournalFlow={() => setJournalFlowOpen(true)} onOpenDoseLog={() => setDoseLogOpen(true)}/>
        </div>
        <div style={{ display: activeTab === 'resources' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
          <ResourcesLibraryScreen/>
        </div>
        <div style={{ display: activeTab === 'community' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
          <CommunityScreen onSelectCommunity={setSelectedCommunity} autoJoinedId={autoJoinedCommunity?.id}/>
        </div>
        {/* Chat is no longer a tab — it opens as a slide-up sheet (rendered at root, below). */}

        {/* Parallax transform: MUST be `none` at rest, not translateX(0). On iOS Safari any
            transform (even identity) creates a composited layer that breaks position:sticky AND
            stops the scroll container from reflowing on content-height change (e.g. summary
            collapse leaves a gap). `none` avoids the layer; it still animates to translateX(-20%). */}
        <div style={{ display: (activeTab === 'careplan' || activeTab === 'plan') ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0, opacity: onboarded ? (treatmentOpt ? 0.6 : 1) : 0, transform: treatmentOpt ? 'translateX(-20%)' : 'none', transition: 'opacity 0.3s, transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)', transformOrigin: 'center' }}>
        {activeTab === 'careplan' && (
          <TodayScreen
            userName={currentUser?.name}
            summary={todaySummary}
            narrative={todaySummary.narrative}
            teasers={summaryTeasers}
            onTeaserAction={onTeaserAction}
            onAddEvent={() => setSheetOpen(true)}
            checkin={checkinState}
            checkinJustChecked={justCheckedLine}
            checkinMoodLabel={checkinMoodLabel}
            checkinCount={checkinCount}
            onCheckinMood={() => setMoodFlowOpen(true)}
            onCheckinMoodSelect={(v) => logMood({ id: 'mood_' + Date.now(), date: localDateStr(), value: v, label: (MOOD_SCALE.find(m => m.v === v) || {}).label })}
            onCheckinSymptomsYes={() => { setSymptomFlowEntry(null); setSymptomFlowOpen(true) }}
            onCheckinSymptomsEdit={() => { setSymptomFlowEntry(checkinSymptomEntry); setSymptomFlowOpen(true) }}
            checkinSymptomEntry={checkinSymptomEntry}
            onCheckinSymptomsNo={symptomNoneToday}
            onCheckinJournal={() => { setJournalFlowEntry(null); setJournalFlowOpen(true) }}
            onCheckinJournalEdit={() => { setJournalFlowEntry(checkinJournalEntry); setJournalFlowOpen(true) }}
            checkinJournalEntry={checkinJournalEntry}
            onCheckinJournalSave={(text) => logJournal({ id: 'jrn_' + Date.now(), date: localDateStr(), text })}
            todos={todos}
            onTodoAction={onTodoAction}
            onViewTimeline={() => switchTab('plan')}
            onViewTreatments={() => switchTab('plan')}
            hasTreatments={!!(visibleRecs && visibleRecs.length)}
            onAsk={openChat}
            onViewCareSummary={() => setCareSummaryOpen(true)}
            cancerLabel={CANCER_LABELS[patientState.diagnosisCode] || 'your cancer'}
            onViewResources={() => switchTab('resources')}
            todOverride={todOverride}
            onAskClinical={() => setAskOpen(true)}
            onOpenCommunity={() => switchTab('community')}
          />
        )}
        <div
          ref={scrollRef}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorY: 'contain', position: 'relative', display: activeTab === 'plan' ? 'block' : 'none' }}
          onTouchStart={e => { if (scrollRef.current?.scrollTop === 0) scrollRef.current._pullStart = e.touches[0].clientY }}
          onTouchMove={e => {
            const sc = scrollRef.current
            if (!sc || sc.scrollTop > 0 || !sc._pullStart) return
            const dist = e.touches[0].clientY - sc._pullStart
            if (dist > 0) setPullDistance(Math.min(dist * 0.4, 80))
          }}
          onTouchEnd={() => {
            if (pullDistance > 60) {
              setPullDistance(0)
              setRevealedCards(new Set())
              setBlockGenStates({})
              setGenText(null)
              setGenBlockId(null)
              setGenerationDone(false)
              setSummaryShown(false)
              setRefreshKey(k => k + 1)
            } else {
              setPullDistance(0)
            }
            if (scrollRef.current) scrollRef.current._pullStart = null
          }}
        >
          {pullDistance > 0 && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', height: pullDistance * 1.2, opacity: Math.min(pullDistance / 60, 1) }}>
              <div style={{ width: 26, height: 26, borderRadius: 13, border: `2.5px solid ${pullDistance > 60 ? C.primary : C.border}`, borderTopColor: 'transparent', transform: `rotate(${pullDistance * 3}deg)`, transition: 'border-color 0.2s' }}/>
            </div>
          )}
          {/* 60px top SPACER (not paddingTop) so sticky day headers anchor to the viewport top
              when the glass bar collapses */}
          <div style={{ height: 60 }}/>
          {(() => {
            let globalItemIdx = 0
            return timelineWithRecs.map((day, idx) => {
              const dayItemCount = (day.events?.length || 0) + (day.suggested?.length || 0) + (day.summary ? 1 : 0)
              const startIdx = globalItemIdx
              globalItemIdx += dayItemCount
              const dl = {
                mood: [...mood].reverse().find(m => m.date === day.date) || null,
                symptoms: symptoms.filter(s => s.date === day.date),
                journal: journal.filter(j => j.date === day.date),
                none: symptomNone.includes(day.date),
              }
              return (
                <div key={day.date}>
                <DaySection
                  day={day}
                  checkin={checkinState}
                  checkinJustChecked={justCheckedLine}
                  checkinMoodLabel={checkinMoodLabel}
                  checkinCount={checkinCount}
                  onCheckinMood={() => setMoodFlowOpen(true)}
            onCheckinMoodSelect={(v) => logMood({ id: 'mood_' + Date.now(), date: localDateStr(), value: v, label: (MOOD_SCALE.find(m => m.v === v) || {}).label })}
                  onCheckinSymptomsYes={() => { setSymptomFlowEntry(null); setSymptomFlowOpen(true) }}
            onCheckinSymptomsEdit={() => { setSymptomFlowEntry(checkinSymptomEntry); setSymptomFlowOpen(true) }}
            checkinSymptomEntry={checkinSymptomEntry}
                  onCheckinSymptomsNo={symptomNoneToday}
                  onCheckinJournal={() => { setJournalFlowEntry(null); setJournalFlowOpen(true) }}
            onCheckinJournalEdit={() => { setJournalFlowEntry(checkinJournalEntry); setJournalFlowOpen(true) }}
            checkinJournalEntry={checkinJournalEntry}
            onCheckinJournalSave={(text) => logJournal({ id: 'jrn_' + Date.now(), date: localDateStr(), text })}
                  todos={todos}
                  onTodoAction={onTodoAction}
                  dailyLog={dl}
                  summaryTeasers={summaryTeasers}
                  onTeaserAction={onTeaserAction}
                  treatmentBasis={treatmentBasis}
                  isLastDay={idx === timelineWithRecs.length - 1}
                  highlightId={highlightId}
                  todayFlash={todayFlash}
                  summaryShown={summaryShown}
                  onApproachSelect={setTreatmentOpt}
                  addedIds={addedIds}
                  onRemoveEvent={removeEvent}
                  onEditClinical={ev => {
                    const ans = patientState.onboardingAnswers || {}
                    if (ev.id === 'seed_diag' && (patientState.onboardedDate || ans.extent || ans.treatment_phase)) {
                      setAnswerSheet([...(ans.cancer_type && ans.cancer_type !== 'unsure' ? [] : ['cancer_type']), 'extent', 'treatment_phase', 'drivers'])
                    } else setClinicalEditEvent(ev)
                  }}
                  visibleRecs={visibleRecs}
                  revealedCards={revealedCards}
                  blockGenStates={blockGenStates}
                  generationDone={generationDone}
                  genText={genText}
                  genBlockId={genBlockId}
                  onSummarize={(block) => setSummarizeBlock({ block, patientState, planItems: allPlanItems })}
                  onAddEvent={() => setSheetOpen(true)}
                  cancerSupported={isCancerSupported(patientState)}
                  onReviewRecs={scrollToRecs}
                  showRecordsCard={recordsCardVisible && !areRecordsConnected()}
                  onOpenSettings={() => setShowYou(true)}
                  onDismissRecordsCard={handleDismissRecordsCard}
                  sentinelRef={el => {
                    if (el) sentinelRefs.current[day.date] = el
                  }}
                />
                {day.isToday && <SponsoredSlot ad={{ icon: 'volunteer_activism', title: 'Patient assistance program', body: 'See if you qualify for help with treatment costs.' }}/>}
                </div>
              )
            })
          })()}
          <div style={{ height: 100 }}/>
        </div>
        </div>
      </div>

      {onboarded && !hideNav && !kbOpen && activeTab !== 'chat' && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 35 }}>
          <BottomNav activeTab={activeTab} onTabChange={switchTab}/>
        </div>
      )}

      {/* Chat — a slide-up sheet over the whole app (primary nav is covered while it's up) */}
      {onboarded && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 110, display: 'flex', flexDirection: 'column', backgroundColor: C.bgApp, transform: chatOpen ? (chatCovered ? 'translateY(0) scale(0.94)' : 'translateY(0)') : 'translateY(100%)', borderRadius: chatCovered ? 16 : 0, overflow: 'hidden', transition: 'transform 0.38s cubic-bezier(0.32,0.72,0,1)', pointerEvents: chatOpen ? 'auto' : 'none', boxShadow: chatOpen ? '0 -6px 28px rgba(0,0,0,0.16)' : 'none' }}>
          {/* Flows chat opens stack over it: chat steps back and dims (SCRIM) behind them. */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.35)', opacity: chatCovered ? 1 : 0, pointerEvents: 'none', transition: 'opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)' }}/>
          <ChatScreen sheetMode onAskClinical={(q) => { setAskPrefill(q); setAskOpen(true) }} onClose={() => setChatOpen(false)} context={chatContext} patientState={patientState} timeline={timeline} medications={medications} userName={currentUser?.name} onDeepLink={handleChatDeepLink} onDrilledChange={setChatDrilledTitle} onDrillModeChange={setChatDrilled} backSignal={chatBackSignal} deleteSignal={chatDeleteSignal} menuSignal={chatMenuSignal} newSignal={chatNewSignal} onOverflow={() => setChatOverflowOpen(true)} onMenuOpenChange={setChatMenuOpen} onTabChange={(t) => { setChatOpen(false); switchTab(t) }} kbOpen={kbOpen} onCaptureFlow={openCaptureFlow} captureAck={captureAck} onAckConsumed={() => setCaptureAck(null)}/>
        </div>
      )}

      {onboarded && activeTab === 'plan' && (
        <button onClick={() => setSheetOpen(true)} style={{
          position: 'fixed', bottom: 90, right: 20, width: 54, height: 54, borderRadius: 27,
          backgroundColor: C.primary, border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.22)',
          zIndex: 40, opacity: anyDrillInOpen ? 0 : 1, pointerEvents: anyDrillInOpen ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}><Ico.plus/></button>
      )}

      {/* You / Profile overlay — slides up as a full-screen sheet */}
      <YouOverlay show={showYou} fullView={chatOpen} onClose={() => setShowYou(false)} currentUser={currentUser} onLogout={() => { handleLogout(); setShowYou(false) }} onAddPending={() => { setShowYou(false); setTimeout(() => setPendingFlowOpen(true), 340) }} todOverride={todOverride} onSetTod={setTodOverride}/>

      {!onboarded && !authVisible && <OnboardingScreen
        onComplete={completeOnboarding}
        onExit={() => setAuthVisible(true)}
      />}
      {answerSheet && (
        <AnswerQuestionSheet
          questions={answerSheet}
          answers={patientState.onboardingAnswers || {}}
          onSave={applyAnswers}
          onClose={() => setAnswerSheet(null)}
        />
      )}
      {authVisible && <AuthScreen onLogin={handleReturningUser} onNewUser={handleNewUser}/>}
      {clinicalEditEvent && (
        <ClinicalEditSheet
          event={clinicalEditEvent}
          patientState={patientState}
          onSave={applyClinicalEdit}
          onClose={() => setClinicalEditEvent(null)}
        />
      )}

      {treatmentOpt && (
        <TreatmentDetailView
          opt={treatmentOpt}
          onClose={() => setTreatmentOpt(null)}
          addedIds={addedIds}
          patientState={patientState}
          planItems={allPlanItems}
          onAddToPlan={(event, fromFlow) => {
            if (fromFlow) {
              setTreatmentOpt(null)
              handleComplete(event)
            }
          }}
        />
      )}
      {sheetOpen && <AddEventSheet onClose={() => setSheetOpen(false)} onSelectProcedure={() => openFlow('procedure')} onSelectScan={() => openFlow('scan')} onSelectMedication={() => openFlow('medication')} onSelectAppointment={() => openFlow('appointment')}/>}
      {/* Add flows open over chat when they're started from it (saving from chat), so lift them above the chat sheet. */}
      <div style={{ position: 'relative', zIndex: chatOpen ? 130 : 'auto' }}>
      {flow === 'procedure' && <AddProcedureFlow onClose={closeAddFlow} onComplete={handleComplete} preload={flowPreload?.type === 'procedure' ? flowPreload.item : null} planItems={allPlanItems} patientState={patientState}/>}
      {flow === 'scan' && <AddScanFlow onClose={closeAddFlow} onComplete={handleComplete} preload={flowPreload?.type === 'scan' ? flowPreload.item : null} planItems={allPlanItems} patientState={patientState}/>}
      {flow === 'symptom' && <ChatLogSymptomFlow prefill={flowPreload?.item} onClose={closeAddFlow} onSubmit={(entries, manage) => {
        // Symptoms save to the symptom tracker only (no timeline event, not the care plan).
        setSymptoms(prev => [...prev, ...entries]); _pop('symptoms')
        const cap = pendingCaptureRef.current; pendingCaptureRef.current = null
        setFlow(null); setFlowPreload(null)
        const ns = entries.map(e => e.name.toLowerCase())
        const list = ns.length > 1 ? ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1] : ns[0]
        if (manage) setToast({ message: 'In the app, this opens recommendations for easing it.' })
        if (cap) setCaptureAck({ threadId: cap.threadId, id: Date.now(), text: `Your ${list} ${ns.length > 1 ? 'are' : 'is'} saved. ${ns.length > 1 ? "They'll" : "It'll"} show in your symptom tracker.`, msgIndex: cap.msgIndex, answer: cap.answer })
      }}/>}
      {flow === 'medication' && <AddMedicationFlow onClose={closeAddFlow} onComplete={handleComplete} preload={flowPreload?.type === 'medication' ? flowPreload.item : null} planItems={allPlanItems} patientState={patientState}/>}
      {flow === 'appointment' && <AddAppointmentFlow onClose={closeAddFlow} onComplete={handleComplete}/>}
      </div>

      {/* Engagement nudge (feature-flagged, engagementModal) — connect-records bottom sheet */}
      {engagementModalOpen && <EngagementNudgeSheet onConnect={connectRecordsFromNudge} onDismiss={dismissEngagementNudge}/>}
      {onboarded && !anyDrillInOpen && activeTab === 'plan' && (
        <div style={{
          position: 'fixed', bottom: 90, left: 0, right: 0, zIndex: 30,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div onClick={scrollToToday} style={{
            backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 20,
            padding: '8px 20px', cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 6,
            WebkitTapHighlightColor: 'transparent',
            pointerEvents: showTodayPill ? 'auto' : 'none',
            transform: showTodayPill ? 'translateY(0)' : 'translateY(120px)',
            opacity: showTodayPill ? 1 : 0,
            transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.28s ease',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: C.primary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>today</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap' }}>Today</span>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} subtext={toast.subtext} action={toast.action} onDone={() => setToast(null)}/>}
      {/* ── redesign-01 overlays ── */}
      {artifactAppt && <AppointmentArtifactSheet appt={artifactAppt} timeline={timeline} symptoms={symptoms} doseLogs={doseLogs} medications={medications} pending={pending} questions={questions} onSaveQuestions={setQuestions} onClose={() => setArtifactAppt(null)}/>}
      {symptomFlowOpen && <SymptomLogFlow entry={symptomFlowEntry} onClose={() => { setSymptomFlowOpen(false); setSymptomFlowEntry(null) }} onComplete={logSymptom}/>}
      {moodFlowOpen && <MoodFlow onClose={() => setMoodFlowOpen(false)} onComplete={logMood}/>}
      {journalFlowOpen && <JournalFlow entry={journalFlowEntry} onClose={() => { setJournalFlowOpen(false); setJournalFlowEntry(null) }} onComplete={logJournal}/>}
      {careSummaryOpen && <CareSummarySheet symptoms={symptoms} medications={medications} journal={journal} mood={mood} timeline={timeline} patientState={patientState} accountName={currentUser?.name || ''} onSavePatientDetails={d => setPatientState(ps => ({ ...ps, ...d }))} onClose={() => setCareSummaryOpen(false)}/>}
      {pendingFlowOpen && <PendingFlow onClose={() => setPendingFlowOpen(false)} onComplete={addPending}/>}
      {doseLogOpen && <DoseLogSheet medications={medications} onClose={() => setDoseLogOpen(false)} onSave={logDose}/>}
      {confirmOutcome && <ConfirmOutcomeSheet item={confirmOutcome} onClose={() => setConfirmOutcome(null)} onConfirm={resolveNextStep}/>}
      {teaserDetail && <TeaserDetailSheet teaser={teaserDetail} onClose={() => setTeaserDetail(null)}/>}
      {askOpen && <AskO4MSheet fullView={chatOpen} initialQuestion={askPrefill} onClose={() => { setAskOpen(false); setAskPrefill('') }} onSend={() => { setAskPrefill(''); setAskOpen(false); setToast({ message: 'Sent to the O4M clinical team', subtext: "They'll follow up with you" }) }}/>}

      {chatOverflowOpen && (
        <>
          <div onClick={() => setChatOverflowOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 125 }}/>
          <div style={{ position: 'fixed', top: 54, right: 12, zIndex: 126, minWidth: 168, backgroundColor: C.bgCard, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, boxShadow: '0 2px 6px rgba(0,0,0,0.06), 0 14px 32px rgba(0,0,0,0.08)', overflow: 'hidden', animation: 'flyoutIn 0.16s ease', transformOrigin: 'top right' }}>
            <button onClick={() => { setChatOverflowOpen(false); setChatConfirmDelete(true) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#B00020' }}>delete</span>
              <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: '#B00020' }}>Delete</span>
            </button>
          </div>
        </>
      )}
      {chatConfirmDelete && (
        <ChatDeleteDialog
          title={chatDrilledTitle}
          onCancel={() => setChatConfirmDelete(false)}
          onDelete={() => { setChatConfirmDelete(false); setChatDeleteSignal(n => n + 1) }}
        />
      )}
      {summarizeBlock && <SummarizeSheet block={summarizeBlock.block} patientState={summarizeBlock.patientState} planItems={summarizeBlock.planItems} onClose={() => setSummarizeBlock(null)}/>}
      {selectedCommunity && <CommunityDetailView community={selectedCommunity} onClose={() => setSelectedCommunity(null)}/>}
    </div>
    </>
    </PatientCopyContext.Provider>
  )
}