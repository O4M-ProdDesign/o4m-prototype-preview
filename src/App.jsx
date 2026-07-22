import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { findCoveringRule, findRuleMatchingItem, findMatchingRules, wouldImpactRecommendations, getImpactContext } from './services/recommendationService.js'
import { hydrateState, savePatientState, saveTimeline, saveUserDecisions, clearPersistedState, saveMedications, loadMedications } from './services/persistenceService.js'
import { loadSession, login, createAccount, logout } from './services/authService.js'
import { useRecommendations } from './hooks/useRecommendations.js'
import { COMMUNITIES, COMMUNITY_POSTS, POST_COMMENTS } from './data/communityData.js'
import { getDetailData, getRegimenData } from './services/treatmentService.js'
import { getProcedureCatalog, getProcedureSuggested, getScanCatalog, getScanSuggested, getMedicationCatalog, getMedicationSuggested, searchCatalog } from './services/catalogService.js'

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

// ─── DATA ─────────────────────────────────────────────────────────
const INITIAL_TIMELINE = (() => {
  const daysAgo = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
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
  { name: 'Dr. Sarah Chen',      subtitle: 'Medical Oncologist',            searchTerms: ['sarah', 'chen', 'oncologist', 'medical oncologist', 'kidney', 'rcc'], location: '300 Longwood Ave Boston MA',       avatar: 'SC' },
  { name: 'Dr. Michael Torres',  subtitle: 'Surgical Oncologist',           searchTerms: ['michael', 'torres', 'surgical', 'surgery', 'surgeon'],              location: '55 Fruit St Boston MA',            avatar: 'MT' },
  { name: 'Dr. Amanda Park',     subtitle: 'Radiation Oncologist',          searchTerms: ['amanda', 'park', 'radiation', 'radiotherapy', 'sbrt'],              location: '1400 Pelham Pkwy S Bronx NY',      avatar: 'AP' },
  { name: 'Dr. Lisa Nguyen',     subtitle: 'Hematologist',                  searchTerms: ['lisa', 'nguyen', 'hematologist', 'blood', 'hematology'],            location: '221 Longwood Ave Boston MA',       avatar: 'LN' },
  { name: 'Dr. Robert Kim',      subtitle: 'Radiologist',                   searchTerms: ['robert', 'kim', 'radiologist', 'radiology', 'imaging'],             location: '75 Francis St Boston MA',          avatar: 'RK' },
  { name: 'Dr. James Wilson',    subtitle: 'Palliative Care Specialist',    searchTerms: ['james', 'wilson', 'palliative', 'comfort', 'hospice'],              location: '',                                 avatar: 'JW' },
  { name: 'Dr. Emily Rodriguez', subtitle: 'Oncology Nurse Practitioner',   searchTerms: ['emily', 'rodriguez', 'nurse', 'np', 'practitioner'],               location: '300 Longwood Ave Boston MA',       avatar: 'ER' },
  { name: 'Dr. David Patel',     subtitle: 'Oncology Pharmacist',           searchTerms: ['david', 'patel', 'pharmacist', 'pharmacy', 'medication'],           location: '',                                 avatar: 'DP' },
  { name: 'Dr. Jennifer Lee',    subtitle: 'Clinical Nutritionist Oncology',searchTerms: ['jennifer', 'lee', 'nutritionist', 'dietitian', 'nutrition', 'diet'],location: '1 Medical Center Blvd',            avatar: 'JL' },
  { name: 'Dr. Marcus Brown',    subtitle: 'Pain Management Specialist',    searchTerms: ['marcus', 'brown', 'pain', 'management', 'analgesic'],               location: '500 University Ave',               avatar: 'MB' },
  { name: 'Dr. Aisha Johnson',   subtitle: 'Oncology Social Worker',        searchTerms: ['aisha', 'johnson', 'social', 'worker', 'support'],                 location: '',                                 avatar: 'AJ' },
]
const CARE_TEAM = PROVIDERS.slice(0, 3)
const APPOINTMENT_TYPES = ['In Office', 'Virtual', 'Phone Call', 'Lab Work', 'Imaging', 'Other']
const LOCATION_REQUIRED_TYPES = ['In Office', 'Lab Work', 'Imaging']

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
const dayLabel = (dateStr, isToday) => {
  if (isToday) return null  // handled separately
  const d = new Date(dateStr + 'T12:00:00')
  const thisYear = new Date().getFullYear() === d.getFullYear()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(thisYear ? {} : { year: 'numeric' }) })
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
  cal: () => <svg width="15" height="16" viewBox="0 0 15 16" fill="none"><rect x="1" y="2" width="13" height="12.5" rx="2" stroke="#888" strokeWidth="1.3"/><path d="M5 1V3M10 1V3M1 6H14" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  notes: () => <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M1 1H13M1 5H10M1 9H8" stroke="rgba(0,0,0,0.3)" strokeWidth="1.3" strokeLinecap="round"/></svg>,

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

const typeLabel = { procedure: 'Procedure/Surgery', medication: 'Medication', scan: 'Test', diagnosis: 'Diagnosis' }
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
    <button onClick={onBack} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
      <Ico.back/>
    </button>
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

const DateInputField = ({ label, value, onChange, required, min, max }) => {
  const [on, setOn] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>{label}{required && <span style={{ color: C.primary }}> *</span>}</div>
      <div style={{ position: 'relative', border: on ? `2px solid ${C.primary}` : `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '12px', display: 'flex', alignItems: 'center', backgroundColor: C.bgCard }}>
        <input type="date" value={value} min={min} max={max} onChange={e => {
          const v = e.target.value
          if (min && v && v < min) return
          if (max && v && v > max) return
          onChange(v)
        }} onFocus={() => setOn(true)} onBlur={() => setOn(false)} style={{ fontSize: 16, color: value ? C.textPrimary : C.textTertiary, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter,sans-serif', flex: 1, zIndex: 1, position: 'relative' }}/>
        <Ico.cal/>
      </div>
      <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 5 }}>Approximate dates are fine. You can update this later.</div>
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
  const [on, setOn] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>{label}</div>
      <div style={{ border: on ? `2px solid ${C.primary}` : `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '12px', display: 'flex', alignItems: 'center', backgroundColor: C.bgCard }}>
        <input type="time" value={value} onChange={e => onChange(e.target.value)} onFocus={() => setOn(true)} onBlur={() => setOn(false)}
          style={{ fontSize: 16, color: value ? C.textPrimary : C.textTertiary, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter,sans-serif', flex: 1 }}/>
      </div>
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
              backgroundColor: C.primaryLight, border: `1px solid rgba(255,121,88,0.3)`, borderRadius: 9999,
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
  const reallyDismiss = () => { setVis(false); setTimeout(onClose, 340) }
  const dismiss = () => {
    if (confirmClose) setShowLeaveConfirm(true)
    else reallyDismiss()
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex,
      transform: vis ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Persistent header — never slides */}
      <NavBar title={nav.title} subtitle={nav.subtitle} onBack={nav.onBack || dismiss} onClose={dismiss}/>
      {/* Only content slides */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children(dismiss, setNav)}
      </div>
      {showLeaveConfirm && (
        <ConfirmLeaveDialog
          onKeepEditing={() => setShowLeaveConfirm(false)}
          onLeave={() => { setShowLeaveConfirm(false); reallyDismiss() }}
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
  const [start, setStart] = useState(new Date().toISOString().split('T')[0])
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
          { title: 'Add Medication', subtitle: sel?.name, onBack: () => setStep(0) },
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
  <div style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <span style={{ fontSize: 12, fontWeight: 700, color: C.primary, fontFamily: 'Inter,sans-serif' }}>{avatar}</span>
  </div>
)

// ─── PROVIDER SEARCH STEP ─────────────────────────────────────────
const ProviderSearchStep = ({ onSelect, setNav, dismiss, careTeam }) => {
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', backgroundColor: C.primaryLight, border: `1px solid rgba(255,121,88,0.3)`, borderRadius: 9999, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>add</span>
              Add "{q}"
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ADD APPOINTMENT FLOW ─────────────────────────────────────────
const parseProviderLocation = (loc) => {
  if (!loc) return { street: '', city: '', stateAbbr: '' }
  const parts = loc.trim().split(' ')
  const last = parts[parts.length - 1]
  if (parts.length >= 3 && last.length === 2 && /^[A-Z]+$/.test(last)) {
    return { street: parts.slice(0, parts.length - 2).join(' '), city: parts[parts.length - 2], stateAbbr: last }
  }
  return { street: loc, city: '', stateAbbr: '' }
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
  const [zipLoading, setZipLoading] = useState(false)
  const [zipError, setZipError] = useState('')
  const [notes, setNotes] = useState('')
  // Edit-address sheet (temp state so cancel reverts)
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)
  const [locationSheetVisible, setLocationSheetVisible] = useState(false)
  const [editStreet, setEditStreet] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editStateAbbr, setEditStateAbbr] = useState('')
  const [editZip, setEditZip] = useState('')
  const [editZipLoading, setEditZipLoading] = useState(false)
  const [editZipError, setEditZipError] = useState('')

  const hasAnyInput = !!(provider || apptDate || apptTime || apptType || street || city || zip || notes)

  const lookupZip = async (z, setCityFn, setStateFn, setErrFn, setLoadFn) => {
    if (z.length !== 5 || !/^\d{5}$/.test(z)) return
    setLoadFn(true); setErrFn('')
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${z}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const place = data.places?.[0]
      if (place) { setCityFn(place['place name']); setStateFn(place['state abbreviation']) }
    } catch { setErrFn('ZIP not found') }
    finally { setLoadFn(false) }
  }

  const openLocationSheet = () => {
    setEditStreet(street); setEditCity(city); setEditStateAbbr(stateAbbr); setEditZip(zip)
    setEditZipError('')
    setLocationSheetOpen(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setLocationSheetVisible(true)))
  }
  const closeLocationSheet = () => {
    setLocationSheetVisible(false)
    setTimeout(() => setLocationSheetOpen(false), 380)
  }
  const saveLocationSheet = () => {
    setStreet(editStreet); setCity(editCity); setStateAbbr(editStateAbbr); setZip(editZip)
    closeLocationSheet()
  }

  return (
    <FlowShell onClose={onClose} confirmClose={hasAnyInput}>
      {(dismiss, setNav) => {
        const [step, setStep] = useState(0)
        const locationRequired = LOCATION_REQUIRED_TYPES.includes(apptType)
        const hasPrefilledLocation = !!(street || city || stateAbbr)

        const handleProviderSelect = (p) => {
          setProvider(p)
          if (p.location) {
            const parsed = parseProviderLocation(p.location)
            setStreet(parsed.street); setCity(parsed.city); setStateAbbr(parsed.stateAbbr)
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

        const handleTypeSelect = (type) => {
          setApptType(type)
          const needsLocation = LOCATION_REQUIRED_TYPES.includes(type)
          setTimeout(() => setStep(needsLocation ? 4 : 5), 220)
        }

        const finish = () => {
          const providerName = provider?.name || ''
          const locationStr = [street, [city, stateAbbr].filter(Boolean).join(' '), zip].filter(Boolean).join(', ')
          onComplete({
            id: `appt-${Date.now()}`,
            type: 'appointment',
            name: providerName,
            provider: providerName,
            date: apptDate,
            time: apptTime || null,
            appointmentType: apptType,
            location: locationStr || null,
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
          // Step 4: Location — confirm pre-filled or enter; edit via slide-up sheet
          () => (
            <StepView>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 120px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 6, lineHeight: 1.15 }}>Location</div>
                {hasPrefilledLocation ? (
                  <>
                    <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>From {shortDrName(provider?.name)}'s profile</div>
                    <button onClick={openLocationSheet} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ flex: 1 }}>
                        {street && <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{street}</div>}
                        <div style={{ fontSize: 14, color: C.textSecondary }}>{[city, stateAbbr].filter(Boolean).join(', ')}{zip ? ` ${zip}` : ''}</div>
                      </div>
                      <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 400", flexShrink: 0 }}>edit</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>Optional</div>
                    <TextInputField label="Street address" value={street} onChange={setStreet} placeholder="e.g. 300 Longwood Ave"/>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <div style={{ flex: '0 0 110px', position: 'relative' }}>
                        <TextInputField label="ZIP code" value={zip} onChange={v => { setZip(v); if (v.length === 5) lookupZip(v, setCity, setStateAbbr, setZipError, setZipLoading) }} placeholder="02115"/>
                        {zipLoading && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.textSecondary }}>…</div>}
                        {zipError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{zipError}</div>}
                      </div>
                      <div style={{ flex: 1 }}><TextInputField label="City" value={city} onChange={setCity} placeholder="Boston"/></div>
                      <div style={{ flex: '0 0 64px' }}><TextInputField label="State" value={stateAbbr} onChange={setStateAbbr} placeholder="MA"/></div>
                    </div>
                  </>
                )}
              </div>
              <DockedButton label="Next" onClick={() => setStep(5)}/>

              {/* Edit address slide-up sheet */}
              {locationSheetOpen && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
                  {/* Backdrop */}
                  <div onClick={closeLocationSheet} style={{ position: 'absolute', inset: 0, backgroundColor: locationSheetVisible ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0)', transition: 'background-color 0.35s ease' }}/>
                  {/* Sheet */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: C.bgApp, borderRadius: '20px 20px 0 0',
                    padding: '0 0 32px',
                    transform: locationSheetVisible ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform 0.38s cubic-bezier(0.32,0.72,0,1)',
                    boxShadow: '0 -4px 32px rgba(0,0,0,0.12)'
                  }}>
                    {/* Sheet header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Edit address</div>
                      <button onClick={closeLocationSheet} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>close</span>
                      </button>
                    </div>
                    {/* Form */}
                    <div style={{ padding: '0 20px 20px' }}>
                      <TextInputField label="Street address" value={editStreet} onChange={setEditStreet} placeholder="e.g. 300 Longwood Ave"/>
                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <div style={{ flex: '0 0 110px', position: 'relative' }}>
                          <TextInputField label="ZIP code" value={editZip} onChange={v => { setEditZip(v); setEditZipError(''); if (v.length === 5) lookupZip(v, setEditCity, setEditStateAbbr, setEditZipError, setEditZipLoading) }} placeholder="02115"/>
                          {editZipLoading && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.textSecondary }}>…</div>}
                          {editZipError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{editZipError}</div>}
                        </div>
                        <div style={{ flex: 1 }}><TextInputField label="City" value={editCity} onChange={setEditCity} placeholder="Boston"/></div>
                        <div style={{ flex: '0 0 64px' }}><TextInputField label="State" value={editStateAbbr} onChange={setEditStateAbbr} placeholder="MA"/></div>
                      </div>
                    </div>
                    {/* Save button */}
                    <div style={{ padding: '0 20px' }}>
                      <button onClick={saveLocationSheet} style={{ width: '100%', padding: '16px', backgroundColor: C.primary, color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
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

const DailySummaryCard = ({ summary, isToday }) => {
  const [open, setOpen] = useState(true)
  const [vote, setVote] = useState(null)  // 'up' | 'down' | null
  const castVote = (v) => (e) => { e.stopPropagation(); setVote(prev => prev === v ? null : v) }

  const [shownText, setShownText] = useState(summary.text)
  const [generating, setGenerating] = useState(false)
  const [textOpacity, setTextOpacity] = useState(1)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const prevTextRef = useRef(summary.text)
  const pendingRef = useRef(null)
  const genStartRef = useRef(0)
  const resolvingRef = useRef(false)
  const cardRef = useRef(null)
  const starRef = useRef(null)

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
    if (!isVisible()) return
    resolvingRef.current = true
    const elapsed = Date.now() - genStartRef.current
    const wait = Math.max(160, 650 - elapsed)
    setTimeout(() => {
      setTextOpacity(0)
      setTimeout(() => {
        setShownText(pendingRef.current)
        pendingRef.current = null
        setGenerating(false)
        requestAnimationFrame(() => setTextOpacity(1))
        resolvingRef.current = false
      }, 310)
    }, wait)
  }, [isVisible])

  useEffect(() => {
    if (summary.text === prevTextRef.current) return
    prevTextRef.current = summary.text
    pendingRef.current = summary.text
    resolvingRef.current = false
    genStartRef.current = Date.now()
    setGenerating(true)
    setLastUpdated(new Date())
    tryDeliver()
  }, [summary.text, tryDeliver])

  useEffect(() => {
    const el = cardRef.current
    let obs = null
    if (el && typeof IntersectionObserver !== 'undefined') {
      obs = new IntersectionObserver(() => tryDeliver(), { threshold: [0, 0.25, 0.5] })
      obs.observe(el)
    }
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

  const textFade = { opacity: textOpacity, transition: 'opacity 0.28s ease' }

  return (
    <button ref={cardRef} onClick={() => setOpen(o => !o)} style={{ position: 'relative', width: '100%', backgroundColor: C.bgCard, border: '1px solid transparent', borderRadius: 14, padding: '13px 16px', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span ref={starRef} style={{ display: 'inline-flex', transformOrigin: 'center' }}><Ico.spark/></span><span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>Daily summary{!open && <span style={{ ...textFade, fontWeight: 400 }}> &bull; {shownText}</span>}</span><Ico.chevDown open={open}/>
      </div>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.35s ease' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <p style={{ ...textFade, fontSize: 14, color: C.textPrimary, lineHeight: 1.6, margin: '12px 0' }}>{shownText}</p>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={castVote('up')} aria-pressed={vote === 'up'} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: vote === 'up' ? C.primaryLight : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background-color 0.15s' }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill={vote === 'up' ? C.primary : 'none'}><path d="M1.5 7.5h2v5.5h-2zM3.5 7.5L5.5 3l1.5.5V6.5H11L10 12H3.5z" stroke={vote === 'up' ? C.primary : C.textSecondary} strokeWidth="1.1" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={castVote('down')} aria-pressed={vote === 'down'} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: vote === 'down' ? C.primaryLight : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background-color 0.15s' }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill={vote === 'down' ? C.primary : 'none'}><path d="M13.5 7.5h-2V2h2zM11.5 7.5L9.5 12l-1.5-.5V8H4L5 3h6.5z" stroke={vote === 'down' ? C.primary : C.textSecondary} strokeWidth="1.1" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.4 }}>AI-generated from your cancer health plan and recent clinical activity, accuracy may vary. Last updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.</div>
        </div>
      </div>
    </button>
  )
}

// ─── APPOINTMENT CARD ─────────────────────────────────────────────
const AppointmentCard = ({ event, highlightId, onRemove }) => {
  const [showRemove, setShowRemove] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const isHighlighted = highlightId === event.id

  const dateStr = event.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''
  const timeStr = fmtTime12(event.time)
  const dateTimeLine = [dateStr, timeStr].filter(Boolean).join(' · ')
  const typeLocLine = [event.appointmentType, event.location].filter(Boolean).join(' · ')

  return (
    <div
      style={{ width: '100%', backgroundColor: isHighlighted ? '#E4EEFA' : C.bgCard, border: `1px solid ${isHighlighted ? '#A3B8C9' : 'transparent'}`, borderRadius: 14, padding: '12px 16px', transition: 'background 1.8s ease, border-color 1.8s ease', position: 'relative' }}
      onClick={() => setShowRemove(false)}>
      {showRemove && onRemove && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <button onClick={e => { e.stopPropagation(); onRemove(); setShowRemove(false) }}
            style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#ef4444', textAlign: 'left', whiteSpace: 'nowrap' }}>
            Remove from plan
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flexShrink: 0, alignSelf: 'center' }}>{railIcon('appointment', 40)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Appointment</span>
            {onRemove && (
              <button onClick={e => { e.stopPropagation(); setShowRemove(v => !v) }}
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
          {event.notes && (
            <div onClick={e => { e.stopPropagation(); setNotesOpen(v => !v) }} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
              <span style={{ marginTop: 2, flexShrink: 0, display: 'flex' }}><Ico.notes/></span>
              <span style={{ fontSize: 13, color: C.textTertiary, lineHeight: 1.45, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: notesOpen ? 999 : 1, overflow: 'hidden' }}>{event.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const EventCard = ({ event, highlightId, onRemove, visibleRecs = [] }) => {
  const [notesOpen, setNotesOpen] = useState(false)
  const label = typeLabel[event.type] || 'Event'
  const isHighlighted = highlightId === event.id
  const [showRemove, setShowRemove] = useState(false)
  // Check if this item is covered by any currently active recommendation
  const coveringRule = findCoveringRule(event, visibleRecs)
  const du = event.startDate && event.endDate ? fmtDateRange(event.startDate, event.endDate) : event.startDate ? fmtDate(event.startDate) : event.date ? fmtDate(event.date) : ''
  const clar = event.dose || (event.details ? event.details.join(' · ') : null)
  return (
    <div style={{ width: '100%', backgroundColor: isHighlighted ? '#E4EEFA' : C.bgCard, border: `1px solid ${isHighlighted ? '#A3B8C9' : 'transparent'}`, borderRadius: 14, padding: '12px 16px', transition: 'background 1.8s ease, border-color 1.8s ease', position: 'relative' }}
      onClick={() => setShowRemove(false)}>
      {/* Remove action — revealed on tap of ··· */}
      {showRemove && onRemove && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <button onClick={e => { e.stopPropagation(); onRemove(); setShowRemove(false) }}
            style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#ef4444', textAlign: 'left', whiteSpace: 'nowrap' }}>
            Remove from plan
          </button>
          {coveringRule && (
            <div style={{ padding: '0 16px 8px', fontSize: 11, color: C.textTertiary, lineHeight: 1.4 }}>
              {`This will restore it as a suggestion`}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon — flush left, semantic anchor */}
        <div style={{ flexShrink: 0, alignSelf: 'center' }}>{railIcon(event.type, 40)}</div>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {du && <span style={{ fontSize: 12, color: C.textTertiary }}>{du}</span>}
              {onRemove && <button onClick={e => { e.stopPropagation(); setShowRemove(v => !v) }}
                style={{ padding: '0 2px', background: 'none', border: 'none', cursor: 'pointer', color: C.textSecondary, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>⋮</button>}
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.3, marginBottom: clar ? 4 : event.notes ? 5 : 0 }}>{event.name}</div>
      {clar && <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.45, marginBottom: event.notes ? 5 : 0 }}>{clar}</div>}
      {event.notes && <div onClick={e => { e.stopPropagation(); setNotesOpen(v => !v) }} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
            <span style={{ marginTop: 2, flexShrink: 0, display: 'flex' }}><Ico.notes/></span><span style={{ fontSize: 13, color: C.textTertiary, lineHeight: 1.45, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: notesOpen ? 999 : 1, overflow: 'hidden' }}>{event.notes}</span>
          </div>}
        </div>{/* end content */}
      </div>{/* end icon+content row */}
    </div>
  )
}

const GENERATION_MESSAGES = {
  rcc_s13_step1: 'Generating recommended next steps…',
  rcc_s13_step2: 'Generating recommended next steps…',
  rcc_s4_step1: 'Generating recommended next steps…',
  rcc_s4_step2: 'Generating recommended next steps…',
  treatment: 'Generating recommended next steps…',
  supportive: 'Generating recommended next steps…',
  default: 'Generating recommended next steps…',
}

const CANCER_NAMES = {
  RCC: 'kidney cancer', BREAST: 'breast cancer', CRC: 'colorectal cancer',
  LUNG: 'lung cancer', PROS: 'prostate cancer', BLAD: 'bladder cancer',
  OV: 'ovarian cancer', LEUK: 'leukemia', LYMP: 'lymphoma', MM: 'multiple myeloma',
}

// Build a real, dynamic daily-summary string from the person's timeline (past → present → future)
// and their current recommendations. Reacts to any change in either.
const buildDailySummary = (ps, timeline = [], recs = null) => {
  const cancerName = CANCER_NAMES[ps?.diagnosisCode] || ps?.cancerName || 'your cancer'
  const stageLabel = ps?.stage ? `Stage ${ps.stage}` : null
  const hist = ps?.biomarkers?.histology === 'clear-cell' ? 'clear cell ' : ''
  const dx = [stageLabel, `${hist}${cancerName}`].filter(Boolean).join(' ')
  const fmt = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return null } }

  const todayStr = new Date().toISOString().split('T')[0]
  const events = (timeline || []).flatMap(day => (day.events || []).map(e => ({ ...e, _date: day.date, _isToday: !!day.isToday })))
  const nonDx = events.filter(e => e.type !== 'diagnosis')
  const surg = nonDx.find(e => /nephrectomy|prostatectomy|mastectomy|resection|ablation|surgery/i.test(e.name || ''))
  const path = nonDx.find(e => /patholog/i.test(e.name || ''))
  const todayEvents = nonDx.filter(e => e._isToday)

  // Appointment awareness
  const todayAppts = todayEvents.filter(e => e.type === 'appointment')
  const futureAppts = nonDx
    .filter(e => e.type === 'appointment' && !e._isToday && e._date > todayStr)
    .sort((a, b) => a._date.localeCompare(b._date))
  const nextAppt = futureAppts[0] || null

  // Appointment sentences
  const apptSentences = (() => {
    const parts = []
    if (todayAppts.length > 0) {
      const appt = todayAppts[0]
      const dr = shortDrName(appt.provider || appt.name)
      if (appt.appointmentType === 'Virtual') {
        parts.push(`Virtual visit with ${dr} today.`)
      } else if (appt.appointmentType === 'Phone Call') {
        parts.push(`${dr} has a call scheduled today.`)
      } else {
        parts.push(`You're seeing ${dr} today.`)
      }
    }
    if (nextAppt) {
      const name = shortDrName(nextAppt.provider || nextAppt.name)
      if (name) {
        parts.push(`Your next appointment with ${name} is ${relativeApptDate(nextAppt._date)}.`)
      } else {
        parts.push(`Your next appointment is ${relativeApptDate(nextAppt._date)}.`)
      }
    }
    return parts
  })()

  // Treatments the user has added from recommendations — this is what makes the summary react to adds.
  const added = nonDx.filter(e => e.createdFromRecommendationId)

  const recList = Array.isArray(recs) ? recs : []
  const nextLabel = recList[0]?.stepLabel || null
  const optionCount = recList.reduce((n, r) => n + (r.options?.length || 0), 0)

  const surgName = surg ? surg.name.replace(/\s*\(surgery\)/i, '').toLowerCase() : null
  const surgWhen = surg ? fmt(surg._date) : null
  const todayOther = todayEvents.filter(e => e !== surg && e !== path && !e.createdFromRecommendationId && e.type !== 'appointment')

  // Assemble from clauses. `opts` toggles the optional pieces so we can drop them
  // (never truncate mid-word) until the whole thought fits the soft budget.
  const assemble = (opts) => {
    const parts = []
    // 1. Surgery/pathology context
    if (surg && opts.surg) {
      parts.push(`Following your ${surgWhen ? surgWhen + ' ' : ''}${surgName}${path ? ' and pathology review' : ''}, your ${dx || 'care'} plan is active.`)
    } else if (dx) {
      parts.push(`Your ${dx} care plan is active.`)
    } else {
      parts.push('Your care plan is active.')
    }
    // 2. Today's non-appointment clinical events
    if (opts.today && todayOther.length) {
      const names = todayOther.slice(0, 2).map(e => e.name.toLowerCase())
      parts.push(`Today includes ${names.join(' and ')}.`)
    }
    // 3. Today's appointment
    if (opts.todayAppt && apptSentences[0]) parts.push(apptSentences[0])
    // 4. Next upcoming appointment
    if (opts.nextAppt && apptSentences[1]) parts.push(apptSentences[1])
    // 5. Committed plan: treatments the user has added
    if (added.length && opts.added) {
      const desc = added.length === 1 ? added[0].name.toLowerCase() : `${added.length} treatments`
      parts.push(`Your plan now includes ${desc}.`)
    }
    // 6. Future (recommendations)
    if (opts.next) {
      if (added.length) {
        parts.push('More treatment options are available to review below.')
      } else if (nextLabel) {
        const opt = (opts.count && optionCount) ? ` — ${optionCount} treatment option${optionCount > 1 ? 's' : ''} ready to review below` : ''
        parts.push(`Next, your plan focuses on ${nextLabel.toLowerCase()}${opt}.`)
      } else {
        parts.push('Review your recommended next steps below.')
      }
    }
    return parts.join(' ')
  }

  const BUDGET = 350
  // Progressively drop optional clauses; first full thought that fits wins.
  const variants = [
    { surg: true,  today: true,  todayAppt: true,  nextAppt: true,  added: true,  next: true,  count: true  },
    { surg: true,  today: false, todayAppt: true,  nextAppt: true,  added: true,  next: true,  count: true  },
    { surg: true,  today: false, todayAppt: true,  nextAppt: true,  added: true,  next: true,  count: false },
    { surg: true,  today: false, todayAppt: true,  nextAppt: false, added: true,  next: true,  count: false },
    { surg: true,  today: false, todayAppt: true,  nextAppt: false, added: true,  next: false, count: false },
    { surg: true,  today: false, todayAppt: false, nextAppt: false, added: true,  next: false, count: false },
    { surg: false, today: false, todayAppt: false, nextAppt: false, added: true,  next: false, count: false },
    { surg: false, today: false, todayAppt: false, nextAppt: false, added: false, next: false, count: false },
  ]
  for (const v of variants) {
    const s = assemble(v)
    if (s.length <= BUDGET) return s
  }
  // Shortest complete form — returned whole even if it exceeds the soft budget (never cut mid-word).
  return assemble({ surg: false, today: false, todayAppt: false, nextAppt: false, added: false, next: false, count: false })
}

// ─── QUESTION CARD ────────────────────────────────────────────────
const QuestionCard = ({ question, group, onAnswer }) => {
  return (
    <div style={{ backgroundColor: C.bgCard, borderRadius: 14, padding: '16px 16px 12px', animation: 'cardfadein 0.4s ease forwards' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Quick question</div>
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
              <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>For You</div>
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
              <button onClick={runSummary} style={{ padding: '10px 20px', backgroundColor: C.primaryLight, border: `1px solid rgba(255,121,88,0.3)`, borderRadius: 20, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.primary }}>
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


const SuggestedBlock = ({ block, defaultOpen = false, onApproachSelect, addedIds = {}, genState = 'idle', onSummarize = null }) => {
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
        <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, opacity: 0.7 }}>Recommended Next Steps</div>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Recommended Next Steps</div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.2px', color: C.textPrimary }}>{block.stepLabel}</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4, lineHeight: 1.5, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: open ? 999 : 2, overflow: 'hidden' }}>{block.stepBody}</div>

        </div>
        <button onClick={toggle} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: expanded ? 'transparent' : 'rgba(255,121,88,0.1)', border: expanded ? 'none' : `1px solid rgba(255,121,88,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 10, marginTop: 2, transition: 'background 0.22s, border 0.22s' }}>
          <Ico.chevDown open={open}/>
        </button>
      </div>
      {expanded && <div style={{ maxHeight: closing ? '0' : '2000px', overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.4,0,1,1)', margin: '0 -15px', width: 'calc(100% + 30px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Explain card — first in options list */}
          <div style={{ backgroundColor: C.bgCard, borderRadius: 13, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.5 }}>These treatment options are recommended based on your diagnosis</span>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onSummarize && onSummarize(block) }}
              style={{ height: 32, padding: '0 12px', backgroundColor: '#273E4E', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'white', WebkitTapHighlightColor: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: C.primary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>auto_awesome</span>
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

const DaySection = ({ day, sentinelRef, isLastDay = false, highlightId, todayFlash = false, summaryShown = true, onApproachSelect, addedIds = {}, onRemoveEvent, visibleRecs = [], revealedCards = null, blockGenStates = {}, genText = null, genBlockId = null, generationDone = false, onSummarize = null }) => {
  const allItems = []
  // The daily summary is absent while the timeline builds; it's inserted at the top of
  // Today right after the scroll-to-Today settles.
  const showSummary = day.summary && (!day.isToday || summaryShown)
  if (showSummary) allItems.push({ key: 'summary', icon: null, card: <DailySummaryCard summary={day.summary} isToday={day.isToday}/> })
  day.events.forEach(ev => allItems.push({
    key: ev.id, icon: null,
    card: ev.type === 'appointment'
      ? <AppointmentCard event={ev} highlightId={highlightId} onRemove={onRemoveEvent ? () => onRemoveEvent(ev.id, day.date) : null}/>
      : <EventCard event={ev} highlightId={highlightId} onRemove={onRemoveEvent && ev.type !== 'diagnosis' ? () => onRemoveEvent(ev.id, day.date) : null} visibleRecs={visibleRecs}/>
  }))
  ;(day.suggested || []).forEach((blk, i) => allItems.push({ key: blk.id, isSugBlock: true, icon: <div style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.bgCard, border: `1.5px solid ${C.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-rounded" style={{ fontSize: 20, color: C.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>kid_star</span></div>, card: genBlockId === blk.id
              ? <div style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 13, color: C.textSecondary }}>{genText}</span>
                </div>
              : <SuggestedBlock block={blk} defaultOpen={i===0} onApproachSelect={onApproachSelect} addedIds={addedIds} genState={blockGenStates[blk.id] || 'idle'} onSummarize={onSummarize}/> }))
  const lineColor = C.timelineLine  // grey for all regular connections
  const suggestedLineColor = C.timelineLineToday  // orange only adjacent to suggested
  // Find index of last item with an icon
  let lastIconIdx = -1
  allItems.forEach((item, i) => { if (item.icon) lastIconIdx = i })

  return (
    <div style={{ backgroundColor: C.bgApp }}>
      <div ref={sentinelRef} style={{ height: 0 }} data-date={day.date} data-label={day.isToday ? `Today · ${day.label}` : day.label}/>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: C.bgApp, padding: '14px 16px 16px' }}>
        {day.isToday
          ? <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.primary, letterSpacing: '-0.3px', transition: 'opacity 0.15s', opacity: todayFlash ? 0.5 : 1 }}>Today</span>
              <span style={{ fontSize: 16, color: C.textTertiary, fontWeight: 300 }}>·</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.3px' }}>{dayLabel(day.date, false)}</span>
            </div>
          : <span style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.3px' }}>{dayLabel(day.date, false)}</span>
        }
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
            <div key={item.key} data-cardkey={cardKey} style={{ ...animStyle }}>
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

const Toast = ({ message, subtext, onDone }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
    const t1 = setTimeout(() => setVis(false), 2400)
    const t2 = setTimeout(onDone, 2800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  return (
    <div style={{
      position: 'absolute', bottom: 96, left: 16, right: 16,
      transform: `translateY(${vis ? 0 : 12}px)`,
      backgroundColor: 'rgba(22,22,22,0.92)', borderRadius: 14,
      padding: subtext ? '12px 16px' : '10px 18px',
      opacity: vis ? 1 : 0, transition: 'opacity 0.25s, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      zIndex: 100, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{message}</div>
        {subtext && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{subtext}</div>}
      </div>
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
            <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>{parentTitle}</div>
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 32px 24px' }}>
        {/* Logo area */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 30, color: C.primary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>clinical_notes</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', color: C.textPrimary, marginBottom: 8 }}>Outcomes4Me</div>
          <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.6, maxWidth: 260 }}>Evidence-based guidance for your cancer journey</div>
        </div>

        {/* CTAs */}
        <div style={{ width: '100%', maxWidth: 320 }}>
          <button onClick={() => exitThen(onNewUser)} style={{ width: '100%', height: 52, borderRadius: 26, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 12 }}>
            Get started
          </button>
          <button onClick={() => setView('login')} style={{ width: '100%', height: 52, borderRadius: 26, backgroundColor: 'transparent', border: `1.5px solid ${C.border}`, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: C.textPrimary }}>
            Sign in
          </button>
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

const ONBOARDING_STEPS = ['role', 'situation', 'cancer_type', 'cancer_ack', 'diagnosis_date', 'welcome_personalized', 'stage', 'histology', 'treatment_status', 'medications', 'summary', 'account_creation']

const OnboardingAccountCreation = ({ onFinish, SlideIn }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const valid = name.trim() && email.includes('@') && password.length >= 6

  const handleCreate = () => {
    setError('')
    setLoading(true)
    setTimeout(() => {
      const result = createAccount(name, email, password)
      setLoading(false)
      if (result.ok) onFinish(result.user)
      else setError(result.error)
    }, 400)
  }

  return (
    <SlideIn>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>
          Save your care plan
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, marginBottom: 28 }}>
          Create a free account to save your plan and access it anytime.
        </div>
        <AuthField label="Name" value={name} onChange={setName} type="text" placeholder="Your name" required/>
        <AuthField label="Email" value={email} onChange={setEmail} type="email" placeholder="your@email.com" required/>
        <AuthField label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" required
          hint={password.length > 0 && password.length < 6 ? 'At least 6 characters required' : null}/>
        {error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: 8 }}>{error}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        <button onClick={handleCreate} disabled={loading || !valid}
          style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: (loading || !valid) ? '#e0e0e0' : C.primary, border: 'none', cursor: (loading || !valid) ? 'default' : 'pointer', fontSize: 16, fontWeight: 600, color: (loading || !valid) ? '#aaa' : 'white', marginBottom: 12 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <div style={{ fontSize: 11, color: C.textTertiary, textAlign: 'center', lineHeight: 1.6 }}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
    </SlideIn>
  )
}

const OnboardingScreen = ({ onComplete, onAddMedication, onExit }) => {
  const [step, setStep] = useState('role')
  const [stepDir, setStepDir] = useState(1) // 1 = forward, -1 = back
  const [stepKey, setStepKey] = useState(0) // increments to retrigger animation
  const [answers, setAnswers] = useState({})
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const [cancerSearch, setCancerSearch] = useState('')

  const selectedCancer = CANCER_TYPES.find(c => c.code === answers.cancer_type)

  const stepTo = (next, dir = 1) => {
    setStepDir(dir)
    setStepKey(k => k + 1)
    setStep(next)
  }

  const advance = (newAnswers) => {
    const ans = newAnswers || answers
    if      (step === 'role')                 stepTo(ans.role === 'patient' ? 'situation' : 'summary_generic')
    else if (step === 'situation')            stepTo('cancer_type')
    else if (step === 'cancer_type')          stepTo('cancer_ack')
    else if (step === 'cancer_ack')           stepTo('diagnosis_date')
    else if (step === 'diagnosis_date')       stepTo(answers.cancer_type === 'RCC' ? 'stage' : 'treatment_status')
    else if (step === 'stage')                stepTo(ans.cancer_type === 'RCC' ? 'histology' : 'treatment_status')
    else if (step === 'histology')            stepTo('treatment_status')
    else if (step === 'treatment_status')     stepTo('medications')
    else if (step === 'medications')          stepTo('summary')
  }

  const answer = (key, value) => {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    advance(next)
  }

  const finish = (user) => {
    // Resolve matched community from answers
    const CANCER_COMMUNITY_MAP = {
      RCC: { default: 'rcc-general', clear_cell: 'rcc-clear-cell', stage_4: 'rcc-stage-iv' },
      BREAST: { default: 'newly-diagnosed' }, CRC: { default: 'newly-diagnosed' },
      LUNG: { default: 'newly-diagnosed' }, PROS: { default: 'newly-diagnosed' },
      BLAD: { default: 'newly-diagnosed' }, OV: { default: 'newly-diagnosed' },
      LEUK: { default: 'newly-diagnosed' }, LYMP: { default: 'newly-diagnosed' },
      MM: { default: 'newly-diagnosed' },
    }
    const cancerMap = CANCER_COMMUNITY_MAP[answers.cancer_type] || { default: 'newly-diagnosed' }
    const communityId = answers.stage === 'stage_4' && cancerMap.stage_4
      ? cancerMap.stage_4
      : answers.histology === 'clear_cell' && cancerMap.clear_cell
      ? cancerMap.clear_cell
      : cancerMap.default
    const matchedCommunity = COMMUNITIES.flatMap(s => s.items).find(c => c.id === communityId) || null

    setVis(false)
    setTimeout(() => {
      onComplete({
        ...buildPatientState(answers),
        user: user || answers._user || null,
        onboardingMedications: answers.onboardingMedications || [],
        matchedCommunity,
      })
    }, 400)
  }

  const buildPatientState = (ans) => {
    const cancer = CANCER_TYPES.find(c => c.code === ans.cancer_type) || CANCER_TYPES[CANCER_TYPES.length - 1]
    const stage = ans.stage === 'stage_1' ? 'I' : ans.stage === 'stage_2' ? 'II' : ans.stage === 'stage_3' ? 'III' : ans.stage === 'stage_4' ? 'IV' : 'I'
    const hadSurgery = ans.treatment_status === 'surgery'
    const hadOther = ans.treatment_status === 'other'
    return {
      patientState: {
        diagnosisCode: ans.cancer_type || 'RCC',
        stage,
        biomarkers: { histology: ans.histology === 'clear_cell' ? 'clear-cell' : ans.histology === 'non_clear' ? 'non-clear-cell' : 'unknown' },
        performanceStatus: 0,
        cancerName: cancer.name,
      },
      seedEvents: buildSeedEvents(ans, cancer, stage, hadSurgery, hadOther),
    }
  }

  const buildSeedEvents = (ans, cancer, stage, hadSurgery, hadOther) => {
    const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
    const diagDate = ans.diagnosis_date || daysAgo(14)
    const events = []

    // Always: diagnosis event using actual date entered
    events.push({ date: diagDate, event: {
      id: 'seed_diag', type: 'diagnosis',
      name: cancer.name,
      date: diagDate,
      details: [
        ans.stage && ans.stage !== 'unsure' ? `Stage ${ans.stage === 'stage_1' ? 'I' : ans.stage === 'stage_2' ? 'II' : ans.stage === 'stage_3' ? 'III' : 'IV'}` : null,
        ans.histology === 'clear_cell' ? 'Clear cell histology' : ans.histology === 'non_clear' ? 'Non-clear cell histology' : null,
      ].filter(Boolean),
    }})

    // Surgery seeding: if the user indicated they've had surgery, seed procedure events
    if (hadSurgery) {
      events.push({ date: daysAgo(10), event: {
        id: 'seed_surgery', type: 'procedure',
        name: 'Surgery',
        date: daysAgo(10),
      }})
      events.push({ date: daysAgo(4), event: {
        id: 'seed_pathology', type: 'procedure',
        name: 'Pathology review',
        date: daysAgo(4),
      }})
    }

    // Stage IV: add staging scan
    if (stage === 'IV') {
      events.push({ date: diagDate, event: {
        id: 'seed_staging', type: 'scan',
        name: 'Staging CT scan',
        date: diagDate,
      }})
    }

    return events
  }

  // ── Shared primitives ────────────────────────────────────────────
  const Btn = ({ children, onClick, primary, disabled }) => (
    <button onClick={!disabled ? onClick : undefined} style={{
      width: '100%', padding: primary ? '15px 20px' : '14px 20px',
      backgroundColor: disabled ? C.bgApp : primary ? C.primary : C.bgCard,
      border: primary ? 'none' : `1px solid ${disabled ? 'transparent' : C.border}`,
      borderRadius: 13, cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
      fontSize: 15, fontWeight: primary ? 600 : 500,
      color: primary ? 'white' : disabled ? C.textTertiary : C.textPrimary,
      marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      opacity: disabled ? 0.5 : 1,
    }}>
      <span>{children}</span>
      <span style={{ color: primary ? 'rgba(255,255,255,0.7)' : C.primary, fontSize: 18 }}>→</span>
    </button>
  )

  const SlideIn = ({ children }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 24px 40px', overflowY: 'auto' }}>
      {children}
    </div>
  )

  const NextBtn = ({ onPress, disabled, label = 'Next →' }) => (
    <button onClick={!disabled ? onPress : undefined}
      style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: disabled ? '#e0e0e0' : C.primary, border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 16, fontWeight: 600, color: disabled ? '#aaa' : 'white', flexShrink: 0 }}>
      {label}
    </button>
  )

  // ── Step content ─────────────────────────────────────────────────
  const filteredCancers = cancerSearch.trim()
    ? CANCER_TYPES.filter(c => c.name.toLowerCase().includes(cancerSearch.toLowerCase()) || (c.subtitle || '').toLowerCase().includes(cancerSearch.toLowerCase()))
    : CANCER_TYPES

  const STEPS = {
    role: (
      <SlideIn>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 28 }}>Tell us a little about yourself</div>
        {[
          { value: 'patient',      title: "I'm a patient",               sub: "I have cancer or I'm waiting to find out if I do",   enabled: true },
          { value: 'caregiver',    title: "I'm a caregiver",             sub: "I'm helping a loved one who has or may have cancer",  enabled: false },
          { value: 'professional', title: "I'm a medical professional",  sub: "I work with oncology patients",                      enabled: false },
          { value: 'exploring',    title: "I'm just exploring",          sub: "I'm here to learn about cancer and see what the app offers", enabled: false },
        ].map(opt => (
          <Btn key={opt.value} onClick={() => opt.enabled && answer('role', opt.value)} disabled={!opt.enabled}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{opt.title}</div>
              <div style={{ fontSize: 13, color: C.textSecondary, fontWeight: 400 }}>{opt.sub}</div>
            </div>
          </Btn>
        ))}
      </SlideIn>
    ),

    situation: (
      <SlideIn>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>What best describes your current situation?</div>
        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>You can update this anytime. It helps us give you the right tools and support for where you are now.</div>
        {[
          { value: 'waiting',        title: 'Waiting for diagnosis',    sub: 'Test results are pending',                                          enabled: false },
          { value: 'just_diagnosed', title: 'Just diagnosed',           sub: 'Not yet in treatment',                                               enabled: true },
          { value: 'in_treatment',   title: 'In treatment',             sub: 'Receiving treatment now',                                            enabled: false },
          { value: 'ned',            title: 'No evidence of disease',   sub: 'Recovering from cancer or have no evidence of disease',              enabled: false },
        ].map(opt => (
          <Btn key={opt.value} onClick={() => opt.enabled && answer('situation', opt.value)} disabled={!opt.enabled}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{opt.title}</div>
              <div style={{ fontSize: 13, color: C.textSecondary, fontWeight: 400 }}>{opt.sub}</div>
            </div>
          </Btn>
        ))}
      </SlideIn>
    ),

    cancer_type: (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px 24px 12px', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 6 }}>Which cancer have you been diagnosed with?</div>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>If you have more than one, choose the one you want to focus on.</div>
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <span className="material-symbols-rounded" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: C.textTertiary, pointerEvents: 'none', fontVariationSettings: "'FILL' 0, 'wght' 400" }}>search</span>
            <input type="text" value={cancerSearch} onChange={e => setCancerSearch(e.target.value)}
              placeholder="Search by cancer name"
              style={{ width: '100%', height: 44, borderRadius: 10, border: `1px solid ${C.border}`, padding: '0 12px 0 38px', fontSize: 15, color: C.textPrimary, backgroundColor: C.bgCard, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
            />
          </div>
          {!cancerSearch && <div style={{ fontSize: 12, color: C.textTertiary, padding: '8px 0 4px', fontWeight: 500 }}>Common cancers:</div>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>
          {filteredCancers.map(cancer => (
            <button key={cancer.code} onClick={() => answer('cancer_type', cancer.code)}
              style={{ width: '100%', padding: '13px 14px', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{cancer.name}</div>
                {cancer.subtitle && <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{cancer.subtitle}</div>}
              </div>
              <span style={{ color: C.primary, fontSize: 18, flexShrink: 0, marginLeft: 8 }}>→</span>
            </button>
          ))}
          {filteredCancers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textSecondary, fontSize: 14 }}>No results for "{cancerSearch}"</div>
          )}
        </div>
      </div>
    ),

    cancer_ack: (() => {
      const cancer = selectedCancer || { name: 'your cancer', code: 'OTHER' }
      return (
        <SlideIn>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingTop: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 40, color: C.primary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                {cancer.code === 'RCC' ? 'nephrology' : cancer.code === 'BREAST' ? 'cardiology' : cancer.code === 'LEUK' || cancer.code === 'LYMP' || cancer.code === 'MM' ? 'bloodtype' : 'oncology'}
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: C.textPrimary, marginBottom: 16 }}>{cancer.name}</div>
            <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.7, maxWidth: 300 }}>
              Navigating {cancer.name.toLowerCase()} can feel overwhelming, but you're in the right place. We're here to help you find expert-backed guidance and the support you deserve.
            </div>
            <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.7, marginTop: 12 }}>Let's take this next step together.</div>
          </div>
          <NextBtn onPress={() => advance()} />
        </SlideIn>
      )
    })(),

    diagnosis_date: (
      <SlideIn>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>
          When were you diagnosed with {selectedCancer?.name || 'cancer'}?
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
          Even if your cancer changed or came back later, please enter the date you were first diagnosed.
        </div>
        <DateInputField label="Date of initial diagnosis" value={answers.diagnosis_date || ''} onChange={v => setAnswers(a => ({ ...a, diagnosis_date: v }))} max={new Date().toISOString().split('T')[0]} />
        <div style={{ flex: 1 }} />
        <NextBtn onPress={() => advance()} disabled={!answers.diagnosis_date} />
      </SlideIn>
    ),


    stage: (
      <SlideIn>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>What stage is your {selectedCancer?.name || 'cancer'}?</div>
        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>Your doctor will have described this after imaging or surgery. If you're not sure, choose the closest option.</div>
        {[
          { value: 'stage_1', label: 'Stage I',   sub: "Cancer is localised, hasn't spread" },
          { value: 'stage_2', label: 'Stage II',  sub: 'Cancer has grown but is still contained' },
          { value: 'stage_3', label: 'Stage III', sub: 'Cancer has spread to nearby lymph nodes' },
          { value: 'stage_4', label: 'Stage IV',  sub: 'Cancer has spread to other organs' },
          { value: 'unsure',  label: "I'm not sure", sub: null },
        ].map(opt => (
          <Btn key={opt.value} onClick={() => answer('stage', opt.value)}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: opt.sub ? 2 : 0 }}>{opt.label}</div>
              {opt.sub && <div style={{ fontSize: 13, color: C.textSecondary, fontWeight: 400 }}>{opt.sub}</div>}
            </div>
          </Btn>
        ))}
      </SlideIn>
    ),

    histology: (
      <SlideIn>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>What type of kidney cancer cell did your doctor mention?</div>
        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>This is usually found in the pathology report after a biopsy or surgery.</div>
        {[
          { value: 'clear_cell', label: 'Clear cell',     sub: 'The most common type, about 75% of kidney cancers' },
          { value: 'non_clear',  label: 'Non-clear cell', sub: 'Papillary, chromophobe, or other type' },
          { value: 'unsure',     label: "I'm not sure or don't have a report yet", sub: null },
        ].map(opt => (
          <Btn key={opt.value} onClick={() => answer('histology', opt.value)}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: opt.sub ? 2 : 0 }}>{opt.label}</div>
              {opt.sub && <div style={{ fontSize: 13, color: C.textSecondary, fontWeight: 400 }}>{opt.sub}</div>}
            </div>
          </Btn>
        ))}
      </SlideIn>
    ),

    treatment_status: (
      <SlideIn>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>Have you started treatment yet?</div>
        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>This helps us show you the most relevant recommendations for where you are right now.</div>
        {[
          { value: 'surgery', label: 'Yes — I\'ve had surgery',          sub: selectedCancer?.surgery ? `e.g. ${selectedCancer.surgery}` : 'A surgical procedure' },
          { value: 'other',   label: 'Yes — I\'ve had another treatment', sub: 'Radiation, ablation, or systemic therapy' },
          { value: 'no',      label: 'No, treatment hasn\'t started yet', sub: null },
          { value: 'unsure',  label: 'I\'m not sure',                     sub: null },
        ].map(opt => (
          <Btn key={opt.value} onClick={() => answer('treatment_status', opt.value)}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: opt.sub ? 2 : 0 }}>{opt.label}</div>
              {opt.sub && <div style={{ fontSize: 13, color: C.textSecondary, fontWeight: 400 }}>{opt.sub}</div>}
            </div>
          </Btn>
        ))}
      </SlideIn>
    ),


    medications: (() => {
      const meds = answers.onboardingMedications || []
      const diagnosisCode = answers.cancer_type || ''

      return (
        <SlideIn>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>
              Are you taking any medications?
            </div>
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
              Adding them now puts everything in one place from day one. You can always add more later.
            </div>

            {meds.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {meds.map((med, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>medication</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{med.name}</div>
                      {med.subtitle && <div style={{ fontSize: 12, color: C.textSecondary }}>{med.subtitle}</div>}
                    </div>
                    <button onClick={() => {
                      const next = { ...answers, onboardingMedications: meds.filter((_, j) => j !== i) }
                      setAnswers(next)
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textTertiary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => onAddMedication && onAddMedication(item => {
              setAnswers(prev => ({ ...prev, onboardingMedications: [...(prev.onboardingMedications || []), item] }))
            }, diagnosisCode)} style={{
              width: '100%', height: 48, borderRadius: 12, border: `1.5px dashed ${C.border}`,
              backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, color: C.textSecondary, fontSize: 14, fontWeight: 500,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>add</span>
              {meds.length === 0 ? 'Add a medication' : 'Add another'}
            </button>
          </div>

          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <button onClick={() => advance()} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white' }}>
              Continue
            </button>
            {meds.length === 0 && (
              <button onClick={() => advance()} style={{ width: '100%', height: 44, borderRadius: 9999, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: C.textTertiary }}>
                Skip for now
              </button>
            )}
          </div>
        </SlideIn>
      )
    })(),
    summary: (() => {
      const cancer = selectedCancer || { name: 'Cancer', code: 'OTHER', surgery: null }
      const stage = answers.stage === 'stage_1' ? 'Stage I' : answers.stage === 'stage_2' ? 'Stage II' : answers.stage === 'stage_3' ? 'Stage III' : answers.stage === 'stage_4' ? 'Stage IV' : null
      const histLabel = answers.histology === 'clear_cell' ? 'Clear cell' : answers.histology === 'non_clear' ? 'Non-clear cell' : null
      const hadSurgery = answers.treatment_status === 'surgery'
      const isStageIV = answers.stage === 'stage_4'
      const isRCC = answers.cancer_type === 'RCC'
      const role = answers.role || 'patient'
      const onboardingMeds = answers.onboardingMedications || []

      // Match cancer_type + stage to best community
      const CANCER_COMMUNITY_MAP = {
        RCC: { default: 'rcc-general', clear_cell: 'rcc-clear-cell', stage_4: 'rcc-stage-iv' },
        BREAST: { default: 'newly-diagnosed' },
        CRC: { default: 'newly-diagnosed' },
        LUNG: { default: 'newly-diagnosed' },
        PROS: { default: 'newly-diagnosed' },
        BLAD: { default: 'newly-diagnosed' },
        OV: { default: 'newly-diagnosed' },
        LEUK: { default: 'newly-diagnosed' },
        LYMP: { default: 'newly-diagnosed' },
        MM: { default: 'newly-diagnosed' },
      }
      const cancerMap = CANCER_COMMUNITY_MAP[answers.cancer_type] || { default: 'newly-diagnosed' }
      const communityId = answers.stage === 'stage_4' && cancerMap.stage_4
        ? cancerMap.stage_4
        : answers.histology === 'clear_cell' && cancerMap.clear_cell
        ? cancerMap.clear_cell
        : cancerMap.default
      const matchedCommunity = COMMUNITIES.flatMap(s => s.items).find(c => c.id === communityId)

      // Timeline rail items
      const seededItems = []
      seededItems.push({ type: 'diagnosis', label: 'Diagnosis added', detail: [cancer.name, stage, histLabel].filter(Boolean).join(' · ') })
      if (hadSurgery && cancer.surgery) seededItems.push({ type: 'procedure', label: 'Surgery recorded', detail: cancer.surgery })
      if (isStageIV) seededItems.push({ type: 'scan', label: 'Staging scan added', detail: 'CT scan confirming metastatic disease' })
      onboardingMeds.forEach(med => seededItems.push({ type: 'medication', label: med.name, detail: 'Added to your plan and tracker' }))

      const nextStepsText = hadSurgery
        ? `Based on your surgery, we've identified recommended next steps${isRCC ? ' including adjuvant therapy options and surveillance' : ''}.`
        : `Based on your diagnosis, we've identified${isRCC ? ' primary treatment options your care team may recommend' : ' relevant resources and information for your situation'}.`

      const roleContent = {
        patient: {
          headline: 'Understanding your options changes everything.',
          body: `Your plan is built from the same clinical guidelines your care team uses. That means you're not guessing — you're informed, at every step.`,
        },
        caregiver: {
          headline: 'You just became their best advocate.',
          body: `The people who make the biggest difference show up prepared. This plan is built from the same clinical guidelines the care team uses — so you can advocate with confidence, not just hope.`,
        },
        professional: {
          headline: 'Shared decision-making starts here.',
          body: `Your patient has a plan grounded in the same NCCN guidelines you work from — a shared foundation for every decision ahead.`,
        },
      }
      const rc = roleContent[role] || roleContent.patient

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 100px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>
              {rc.headline}
            </div>
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7, marginBottom: 20 }}>
              {rc.body}
            </div>

            {/* Section 1 — Your plan (timeline rail) */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Your plan preview</div>
            <div style={{ marginBottom: 20 }}>
              {seededItems.map((item, i) => (
                <div key={i}>
                  <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flexShrink: 0 }}>{railIcon(item.type, 40)}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{item.detail}</div>
                    </div>
                  </div>
                  <div style={{ paddingLeft: 34, boxSizing: 'border-box' }}>
                    <div style={{ width: 3, height: 12, background: i < seededItems.length - 1 ? C.timelineLine : `linear-gradient(to bottom, ${C.timelineLine}, ${C.timelineLineToday})`, borderRadius: 2 }}/>
                  </div>
                </div>
              ))}
              <div style={{ backgroundColor: C.primaryLight, border: `1px solid rgba(255,121,88,0.25)`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,121,88,0.12)', border: `1.5px solid ${C.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20, color: C.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>kid_star</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>Recommendations ready</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{nextStepsText}</div>
                </div>
              </div>
            </div>

            {/* Section 2 — Also set up for you */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Also set up for you</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {onboardingMeds.length > 0 && (
                <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#16a34a', fontVariationSettings: "'FILL' 0, 'wght' 300" }}>medication</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>Medication tracker seeded</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{onboardingMeds.map(m => m.name).join(', ')}</div>
                  </div>
                </div>
              )}
              {matchedCommunity && (
                <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${matchedCommunity.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: matchedCommunity.color }}>{matchedCommunity.initials}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>Joined {matchedCommunity.name}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{matchedCommunity.memberCount.toLocaleString()} members</div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: C.textTertiary, lineHeight: 1.6 }}>
              {isRCC ? 'Based on NCCN Clinical Practice Guidelines for Kidney Cancer. ' : 'Based on your answers. '}
              Your care team will personalise these recommendations. Nothing here replaces medical advice.
            </div>
          </div>

          <DockedButton label="Save my plan" onClick={() => stepTo('account_creation')}/>
        </div>
      )
    })(),


    summary_generic: (
      <SlideIn>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, marginBottom: 16 }}>Welcome</div>
          <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.65 }}>
            You can explore the care plan features and resources available. Update your profile anytime to personalise your experience.
          </div>
        </div>
        <button onClick={() => finish(null)} style={{ width: '100%', height: 54, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'white' }}>
          Continue
        </button>
      </SlideIn>
    ),

    account_creation: <OnboardingAccountCreation onFinish={finish} SlideIn={SlideIn}/>,
  }

  // Progress bar — green, production style
  const progressSteps = ['role', 'situation', 'cancer_type', 'cancer_ack', 'diagnosis_date', 'stage', 'histology', 'treatment_status', 'medications']
  const stepIdx = progressSteps.indexOf(step)
  const progress = stepIdx >= 0 ? (stepIdx + 1) / progressSteps.length : (step === 'summary' || step === 'account_creation' ? 1 : 0)
  const showProgress = !['summary_generic'].includes(step)
  const showBack = !['welcome_personalized', 'summary_generic', 'account_creation'].includes(step)

  const goBack = () => {
    if (step === 'role') { onExit && onExit(); return }
    const backMap = {
      situation: 'role', cancer_type: 'situation',
      cancer_ack: 'cancer_type', diagnosis_date: 'cancer_ack',
      welcome_personalized: 'diagnosis_date',
      stage: 'welcome_personalized', histology: 'stage',
      treatment_status: answers.cancer_type === 'RCC' ? 'histology' : 'stage',
      medications: 'treatment_status',
      summary: 'medications',
    }
    if (backMap[step]) stepTo(backMap[step], -1)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      backgroundColor: C.bgCard,
      display: 'flex', flexDirection: 'column',
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 0.38s ease, transform 0.38s ease',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* Shared app header with progress bar pinned to its bottom */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 8px 0 4px', backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}` }}>
          {showBack ? (
            <button onClick={goBack} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              <Ico.back/>
            </button>
          ) : <div style={{ width: 38, flexShrink: 0 }}/>}
          <div style={{ flex: 1, textAlign: 'center', pointerEvents: 'none' }}>
          </div>
          <div style={{ width: 38, flexShrink: 0 }}/>
        </div>
        {/* Progress bar — fixed to bottom edge of header, only shown on clinical steps */}
        {showProgress && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: C.border }}>
            <div style={{ height: '100%', backgroundColor: '#22c55e', width: `${progress * 100}%`, transition: 'width 0.3s ease' }}/>
          </div>
        )}
      </div>
      <div key={stepKey} style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: `stepEnter${stepDir > 0 ? 'Fwd' : 'Bwd'} 0.22s ease-out forwards`,
      }}>
        {STEPS[step] || STEPS['summary']}
      </div>
    </div>
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
  { id: 'careplan',  label: 'Home',       icon: 'home' },
  { id: 'track',     label: 'Track',      icon: 'monitor_heart' },
  { id: 'community', label: 'Community',  icon: 'group' },
]

const BottomNav = ({ activeTab, onTabChange }) => (
  <div style={{
    display: 'flex', height: 72, backgroundColor: C.bgCard,
    borderTop: `1px solid ${C.border}`, flexShrink: 0, paddingBottom: 10,
  }}>
    {NAV_TABS.map(tab => {
      const active = activeTab === tab.id
      return (
        <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 3, background: 'none', border: 'none',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', padding: 0,
        }}>
          <span className="material-symbols-rounded" style={{
            fontSize: 24, color: active ? C.primary : C.textTertiary,
            fontVariationSettings: `'FILL' ${active ? 1 : 0}, 'wght' 400`,
            transition: 'color 0.15s',
          }}>{tab.icon}</span>
          <span style={{
            fontSize: 10, fontWeight: active ? 600 : 400,
            color: active ? C.primary : C.textTertiary,
            transition: 'color 0.15s', letterSpacing: '0.01em',
          }}>{tab.label}</span>
        </button>
      )
    })}
  </div>
)

// ─── PLACEHOLDER SCREENS ─────────────────────────────────────────

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
          {item.subtitle && <div style={{ fontSize: 13, fontWeight: 500, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>{item.subtitle}</div>}
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 20px 32px', overflowY: 'auto' }}>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', position: 'relative', backgroundColor: C.bgCard }}>
      {isEmpty ? (
        // ── Empty state ─────────────────────────────────────────
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 38, color: C.primary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>medication</span>
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
const TrackScreen = ({ medications, patientState, onSaveMedication }) => {
  const [trackTab, setTrackTab] = useState('medications')
  const [medInfoView, setMedInfoView] = useState(null)

  const openSearch = () => {
    setMedInfoView({ type: 'search' })
  }

  const TRACK_TABS = [
    { id: 'medications', label: 'Medications' },
    { id: 'symptoms',    label: 'Symptoms' },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: C.bgCard }}>
      <SegmentedControl tabs={TRACK_TABS} active={trackTab} onChange={setTrackTab}/>
      {trackTab === 'medications' && (
        <MedicationsTab
          medications={medications}
          patientState={patientState}
          onAddTapped={openSearch}
          medInfoView={medInfoView}
          setMedInfoView={setMedInfoView}
          onSaveMedication={onSaveMedication}
        />
      )}
      {trackTab === 'symptoms' && <SymptomsTab/>}
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
  <div style={{ flex: 1, overflowY: 'auto', backgroundColor: C.bgCard }}>
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


const YouOverlay = ({ show, onClose, currentUser, onLogout }) => {
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 85, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
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
        height: '92%',
        backgroundColor: C.bgApp,
        borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }}/>
        </div>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Account</div>
          <button onClick={dismiss} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: C.textSecondary, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>close</span>
          </button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <YouScreen currentUser={currentUser} onLogout={onLogout}/>
        </div>
      </div>
    </div>
  )
}

const YouScreen = ({ currentUser, onLogout }) => (
  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: C.bgCard }}>
    {/* Profile header */}
    <div style={{ backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, padding: '28px 20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: C.primary }}>{currentUser?.name?.charAt(0).toUpperCase() || '?'}</span>
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

    {/* Logout */}
    <div style={{ padding: '8px 20px 32px', marginTop: 8 }}>
      <button onClick={onLogout} style={{ width: '100%', height: 50, borderRadius: 12, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 400" }}>logout</span>
        Sign out
      </button>
    </div>
  </div>
)

// ─── APP HEADER ───────────────────────────────────────────────────
// ─── APP HEADER ───────────────────────────────────────────────────
// ─── APP HEADER ───────────────────────────────────────────────────
const AppHeader = ({ currentDayLabel, activeTab = 'careplan', onProfileTap }) => {
  const r = 19, circ = 2 * Math.PI * r, dash = 0.62 * circ
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 20px', backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <div onClick={onProfileTap} style={{ position: 'relative', width: 46, height: 46, marginRight: 12, flexShrink: 0, cursor: 'pointer' }}>
        <svg width="46" height="46" viewBox="0 0 46 46">
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
      {/* Title — absolutely centered so avatar doesn't offset it */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, lineHeight: 1.2 }}>{{ careplan: 'Home', track: 'Track', community: 'Community', you: 'You' }[activeTab] || 'Home'}</div>
      </div>
    </div>
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
  const _isOnboarded = _hydrated.timeline.flatMap(d => d.events || []).length > INITIAL_TIMELINE.flatMap(d => d.events || []).length
  const [onboarded, setOnboarded] = useState(_isOnboarded)
  const [authVisible, setAuthVisible] = useState(!_isOnboarded || !_hasSession)
  const [revealedCards, setRevealedCards] = useState(new Set())
  const [generationDone, setGenerationDone] = useState(false)
  const [showTodayPill, setShowTodayPill] = useState(false)
  const [hidePillOnScroll, setHidePillOnScroll] = useState(false) // slide the pill away while scrolling down, back on scroll up
  const lastScrollTopRef = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0) // cards that have been revealed
  const justAddedRef = useRef(false) // set when the user adds an event, so the group-change replay yields to the add's own scroll/highlight
  const [genText, setGenText] = useState(null)                   // single updating status line
  const [genBlockId, setGenBlockId] = useState(null)              // which block is generating
  const [blockGenStates, setBlockGenStates] = useState({})       // idle | generating | generated
  const [summaryShown, setSummaryShown] = useState(false)        // false during the build; true inserts the Today summary card after the scroll-to-Today settles
  const [timeline, setTimeline] = useState(_hydrated.timeline)
  const [userDecisions, setUserDecisions] = useState(_hydrated.userDecisions)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [flow, setFlow] = useState(null)
  const [toast, setToast] = useState(null)
  const [currentDayLabel, setCurrentDayLabel] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [todayFlash, setTodayFlash] = useState(false)
  const [treatmentOpt, setTreatmentOpt] = useState(null)
  const [summarizeBlock, setSummarizeBlock] = useState(null)
  const [activeTab, setActiveTab] = useState('careplan')
  const [tabDir, setTabDir] = useState(1)
  const [tabKey, setTabKey] = useState(0)
  const prevTabRef = useRef('careplan')
  const [showYou, setShowYou] = useState(false)
  const [appReveal, setAppReveal] = useState(false)
  const [currentUser, setCurrentUser] = useState(loadSession)
  const [selectedCommunity, setSelectedCommunity] = useState(null)
  const [autoJoinedCommunity, setAutoJoinedCommunity] = useState(null)
  const [onboardingMedFlow, setOnboardingMedFlow] = useState(false)
  const [onboardingMedDiagnosis, setOnboardingMedDiagnosis] = useState('')
  const onboardingMedCallbackRef = useRef(null)
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
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the sentinel that just crossed the top edge (going from visible to invisible above)
        // We want the last date whose sentinel has scrolled past the top = is not intersecting + above
        const passing = entries.filter(e => !e.isIntersecting && e.boundingClientRect.top < e.rootBounds.top)
        if (passing.length > 0) {
          // Pick the one closest to the top (largest negative offset = most recently passed)
          const latest = passing.sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top)[0]
          const date = latest.target.dataset.date
          const day = INITIAL_TIMELINE.find(d => d.date === date)
          // Also check new timeline days
          setCurrentDayLabel(latest.target.dataset.label || date)
        } else {
          // All sentinels visible = at top, no sticky label needed
          const anyAbove = entries.some(e => !e.isIntersecting && e.boundingClientRect.top < 0)
          if (!anyAbove) setCurrentDayLabel(null)
        }
      },
      { root, threshold: 0, rootMargin: '0px 0px -98% 0px' }
    )
    Object.values(sentinelRefs.current).forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [timeline])

  // New user — clear all state and run onboarding from blank slate
  const handleNewUser = () => {
    clearPersistedState()
    setTimeline([])
    setPatientState({})
    setUserDecisions(INITIAL_USER_DECISIONS)
    setMedications([])
    setOnboarded(false)
    setCurrentUser(null)
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
    setTimeline(hydrated.timeline)
    setPatientState(hydrated.patientState)
    setUserDecisions(hydrated.userDecisions)
    setOnboarded(true)
    prevTabRef.current = 'careplan'
    setActiveTab('careplan')
  }

  const handleLogout = () => {
    logout()
    clearPersistedState()
    setCurrentUser(null)
    setAuthVisible(true)
    setOnboarded(false)
    setTimeline(INITIAL_TIMELINE)
    setPatientState(INITIAL_PATIENT_STATE)
    setUserDecisions(INITIAL_USER_DECISIONS)
    setMedications([])
  }

  const TAB_ORDER = ['careplan', 'track', 'community'] // 'you' is an overlay, not a tab
  const switchTab = (next) => {
    const from = TAB_ORDER.indexOf(prevTabRef.current)
    const to   = TAB_ORDER.indexOf(next)
    setTabDir(to >= from ? 1 : -1)
    setTabKey(k => k + 1)
    prevTabRef.current = next
    setActiveTab(next)
    if (next === 'community') setAutoJoinedCommunity(null)
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
        startDate: new Date().toISOString().split('T')[0],
        dose: '',
        notes: '',
        components: med.components || [],
      }))
      setMedications(trackerMeds)
    }

    // Build a fresh timeline from scratch — never merge into prev (stale closure risk)
    const todayStr = new Date().toISOString().split('T')[0]
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

      // Wait for onboarding overlay to fully unmount and careplan to be visible
      await sleep(600)

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
      const st = container.scrollTop
      const last = lastScrollTopRef.current
      const delta = st - last
      lastScrollTopRef.current = st

      const todayDay = timelineWithRecs.find(d => d.isToday)
      if (!todayDay) return
      const el = sentinelRefs.current[todayDay.date]
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cRect = container.getBoundingClientRect()
      // Scrolled past today (today is above the viewport)
      const isPinned = rect.top < cRect.top - 1
      // Today is below the fold
      const isBelowFold = rect.top > cRect.bottom
      setShowTodayPill(isPinned || isBelowFold)

      // Directional awareness — hide pill when scrolling TOWARD today, show when scrolling away.
      // Use 4px deadband to avoid flickering from momentum/deceleration.
      if (Math.abs(delta) > 4) {
        const scrollingDown = delta > 0
        if (isPinned) {
          // Today is ABOVE viewport: scrolling UP (delta<0) = toward today → hide
          setHidePillOnScroll(!scrollingDown)
        } else if (isBelowFold) {
          // Today is BELOW viewport: scrolling DOWN (delta>0) = toward today → hide
          setHidePillOnScroll(scrollingDown)
        }
      }
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
    const target = container.scrollTop + (elRect.top - cRect.top)
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    // Hide immediately — scroll event won't fire until movement starts
    setShowTodayPill(false)
  }

  const openFlow = (type) => { setSheetOpen(false); setTimeout(() => setFlow(type), 310) }

  const removeEvent = (eventId, dayDate) => {
    setTimeline(prev => prev
      .map(day => day.date === dayDate
        ? { ...day, events: day.events.filter(e => e.id !== eventId) }
        : day
      )
      .filter(day => day.events.length > 0 || day.summary || day.isToday)
    )
  }

  const handleComplete = (event) => {
    justAddedRef.current = true // the group-change replay should yield to this add's scroll/highlight
    const dateKey = event.date || event.startDate || new Date().toISOString().split('T')[0]
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

  }

  // Derive recommendations, addedIds, and allPlanItems from current state
  const { allPlanItems, visibleRecs, addedIds } = useRecommendations(patientState, timeline)
  const anyDrillInOpen = !!(treatmentOpt || selectedCommunity || showYou || summarizeBlock || flow || sheetOpen)

  // Inject visible recommendations into today's day — derived, not stored
  const timelineWithRecs = timeline.map(day => {
    if (!day.isToday) return day
    const recs = visibleRecs.length > 0 ? visibleRecs : null
    return { ...day, suggested: recs, summary: { text: buildDailySummary(patientState, timeline, recs) } }
  })

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
          c.scrollTo({ top: Math.max(0, offsetTop - 16), behavior: 'smooth' })
        }
      }
    }, 100)

    // Store messages where the generation useEffect can read them
    planUpdateMessagesRef.current = updateMessages
    setRefreshKey(k => k + 1)
  }, [visibleRecs])

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: C.bgApp, position: 'relative' }}>
      <div style={{ animation: appReveal ? 'appReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards' : 'none' }}>
        {onboarded && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 45,
            opacity: anyDrillInOpen ? 0 : 1,
            pointerEvents: anyDrillInOpen ? 'none' : 'auto',
            transition: 'opacity 0.2s ease',
          }}>
            <AppHeader currentDayLabel={activeTab === 'careplan' ? currentDayLabel : null} activeTab={activeTab} onProfileTap={() => setShowYou(true)}/>
          </div>
        )}
        {/* Spacer for fixed header — only when onboarded */}
        {onboarded && <div style={{ height: 60 }}/>}

        <div style={{ display: activeTab === 'track' ? 'flex' : 'none', height: (onboarded && !anyDrillInOpen) ? 'calc(100vh - 132px)' : '100vh', flexDirection: 'column', overflow: 'hidden' }}>
          <TrackScreen medications={medications} patientState={patientState} onSaveMedication={handleSaveMedication}/>
        </div>
        <div style={{ display: activeTab === 'community' ? 'flex' : 'none', height: (onboarded && !anyDrillInOpen) ? 'calc(100vh - 132px)' : '100vh', flexDirection: 'column', overflow: 'hidden' }}>
          <CommunityScreen onSelectCommunity={setSelectedCommunity} autoJoinedId={autoJoinedCommunity?.id}/>
        </div>

        <div
          ref={scrollRef}
          style={{ display: activeTab === 'careplan' ? undefined : 'none', height: (onboarded && !anyDrillInOpen) ? 'calc(100vh - 132px)' : '100vh', overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorY: 'contain', opacity: onboarded ? (treatmentOpt ? 0.6 : 1) : 0, transform: treatmentOpt ? 'translateX(-20%)' : 'translateX(0)', transition: 'opacity 0.3s, transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)', transformOrigin: 'center', position: 'relative' }}
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
          {(() => {
            let globalItemIdx = 0
            return timelineWithRecs.map((day, idx) => {
              const dayItemCount = (day.events?.length || 0) + (day.suggested?.length || 0) + (day.summary ? 1 : 0)
              const startIdx = globalItemIdx
              globalItemIdx += dayItemCount
              return (
                <DaySection
                  key={day.date}
                  day={day}
                  isLastDay={idx === timeline.length - 1}
                  highlightId={highlightId}
                  todayFlash={todayFlash}
                  summaryShown={summaryShown}
                  onApproachSelect={setTreatmentOpt}
                  addedIds={addedIds}
                  onRemoveEvent={removeEvent}
                  visibleRecs={visibleRecs}
                  revealedCards={revealedCards}
                  blockGenStates={blockGenStates}
                  generationDone={generationDone}
                  genText={genText}
                  genBlockId={genBlockId}
                  onSummarize={(block) => setSummarizeBlock({ block, patientState, planItems: allPlanItems })}
                  sentinelRef={el => {
                    if (el) sentinelRefs.current[day.date] = el
                  }}
                />
              )
            })
          })()}
          <div style={{ height: 24 }}/>
        </div>
      </div>

      {onboarded && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 45,
          opacity: anyDrillInOpen ? 0 : 1,
          pointerEvents: anyDrillInOpen ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}>
          <BottomNav activeTab={activeTab} onTabChange={switchTab}/>
        </div>
      )}

      {onboarded && activeTab === 'careplan' && (
        <button onClick={() => setSheetOpen(true)} style={{
          position: 'fixed', bottom: 90, right: 20, width: 54, height: 54, borderRadius: 27,
          backgroundColor: C.primary, border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.22)',
          zIndex: 40, opacity: anyDrillInOpen ? 0 : 1, pointerEvents: anyDrillInOpen ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}><Ico.plus/></button>
      )}

      {/* You / Profile overlay — slides up as a full-screen sheet */}
      <YouOverlay show={showYou} onClose={() => setShowYou(false)} currentUser={currentUser} onLogout={() => { handleLogout(); setShowYou(false) }}/>

      {!onboarded && <OnboardingScreen
        onComplete={completeOnboarding}
        onAddMedication={(cb, diagnosisCode) => { onboardingMedCallbackRef.current = cb; setOnboardingMedDiagnosis(diagnosisCode || ''); setOnboardingMedFlow(true) }}
        onExit={() => setAuthVisible(true)}
      />}
      {onboardingMedFlow && <AddMedicationFlow
        onClose={() => setOnboardingMedFlow(false)}
        onComplete={event => {
          if (onboardingMedCallbackRef.current) {
            onboardingMedCallbackRef.current({ name: event.name, subtitle: event.subtitle || '', components: event.components || [] })
            onboardingMedCallbackRef.current = null
          }
          setOnboardingMedFlow(false)
        }}
        planItems={[]}
        patientState={{ diagnosisCode: onboardingMedDiagnosis }}
        shellZIndex={91}
        skipNotes={true}
      />}
      {authVisible && <AuthScreen onLogin={handleReturningUser} onNewUser={handleNewUser}/>}

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
      {flow === 'procedure' && <AddProcedureFlow onClose={() => { setFlow(null); setFlowPreload(null) }} onComplete={handleComplete} preload={flowPreload?.type === 'procedure' ? flowPreload.item : null} planItems={allPlanItems} patientState={patientState}/>}
      {flow === 'scan' && <AddScanFlow onClose={() => { setFlow(null); setFlowPreload(null) }} onComplete={handleComplete} preload={flowPreload?.type === 'scan' ? flowPreload.item : null} planItems={allPlanItems} patientState={patientState}/>}
      {flow === 'medication' && <AddMedicationFlow onClose={() => { setFlow(null); setFlowPreload(null) }} onComplete={handleComplete} preload={flowPreload?.type === 'medication' ? flowPreload.item : null} planItems={allPlanItems} patientState={patientState}/>}
      {flow === 'appointment' && <AddAppointmentFlow onClose={() => setFlow(null)} onComplete={handleComplete}/>}
      {onboarded && !anyDrillInOpen && activeTab === 'careplan' && showTodayPill && (
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
            pointerEvents: hidePillOnScroll ? 'none' : 'auto',
            transform: hidePillOnScroll ? 'translateY(120px)' : 'translateY(0)',
            opacity: hidePillOnScroll ? 0 : 1,
            transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.28s ease',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: C.primary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>today</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap' }}>Today</span>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} subtext={toast.subtext} onDone={() => setToast(null)}/>}
      {summarizeBlock && <SummarizeSheet block={summarizeBlock.block} patientState={summarizeBlock.patientState} planItems={summarizeBlock.planItems} onClose={() => setSummarizeBlock(null)}/>}
      {selectedCommunity && <CommunityDetailView community={selectedCommunity} onClose={() => setSelectedCommunity(null)}/>}
    </div>
  )
}