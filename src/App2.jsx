import { useState, useEffect } from 'react'

// ─── DESIGN TOKENS ────────────────────────────────────────────────
const C = {
  primary: '#ff7958',
  primaryLight: '#faeae9',
  bgApp: '#f0eff2',
  bgCard: '#ffffff',
  textPrimary: 'rgba(0,0,0,0.87)',
  textSecondary: 'rgba(0,0,0,0.55)',
  textTertiary: 'rgba(0,0,0,0.35)',
  textIcon: '#535353',
  border: 'rgba(0,0,0,0.10)',
  borderMid: 'rgba(0,0,0,0.14)',
  timelineLine: '#d8d7da',
  timelineLineToday: '#ffb8a6',
}

// ─── DATA ─────────────────────────────────────────────────────────
const INITIAL_TIMELINE = [
  {
    date: '2024-06-02',
    label: 'June 2',
    isToday: false,
    summary: { text: 'Chemotherapy session completed. Bloodwork drawn for CBC and metabolic panel. Vitals stable throughout infusion. No acute adverse reactions noted.' },
    events: [
      { id: 'e1', type: 'procedure', name: 'FOLFOX Chemotherapy Infusion', date: '2024-06-02', notes: 'Session 4 of 8. Tolerated well. Port accessed without issue.' },
      { id: 'e2', type: 'scan', name: 'CBC with Differential', date: '2024-06-02', notes: 'WBC 3.2, Hgb 10.8, Plt 142' },
    ],
    suggested: null,
  },
  {
    date: '2024-06-07',
    label: 'June 7',
    isToday: false,
    summary: { text: 'Oncology follow-up visit. Nausea managed with ondansetron. Dose adjustment discussion deferred to next cycle review.' },
    events: [
      {
        id: 'e4',
        type: 'diagnosis',
        name: 'Stage III Colorectal Adenocarcinoma',
        date: '2024-01-15',
        details: ['T3N1M0', 'MSS · KRAS wild-type · HER2 negative'],
        notes: 'Confirmed via surgical pathology. Referred to oncology same day.',
      },
    ],
    suggested: null,
  },
  {
    date: '2024-06-08',
    label: 'June 8',
    isToday: true,
    summary: { text: 'Rest day. Monitoring for side effects from cycle 4. Peripheral neuropathy reported in hands and feet — documented for dose modification review at next visit. Fatigue score 5/10.' },
    events: [
      { id: 'e5', type: 'procedure', name: 'FOLFOX Infusion — Cycle 4', date: '2024-06-08', notes: 'Tolerated well. No acute reactions.' },
      { id: 'e6', type: 'medication', name: 'Oxaliplatin 85mg/m²', date: '2024-06-08', dose: '85mg/m² IV q2w', startDate: '2024-03-10', notes: 'Part of FOLFOX regimen. Monitor for cumulative neuropathy.' },
    ],
    suggested: {
      stepLabel: 'Treatment Step',
      stepBody: 'Based on your diagnosis and current treatment response, your care team may consider the following next steps.',
      options: [
        { id: 's1', title: 'Add Bevacizumab (Avastin)', description: 'VEGF inhibitor — may extend progression-free survival in MSS tumors after 4–6 FOLFOX cycles' },
        { id: 's2', title: 'Dose Reduction Review', description: 'Grade 2 neuropathy threshold reached — consider oxaliplatin dose modification' },
        { id: 's3', title: 'Restaging CT Scan', description: 'Recommended after 4 cycles to assess tumor response before continuing' },
      ],
    },
  },
]

const PROCEDURE_CATALOG = [
  { name: 'Colectomy (Colon Resection)', subtitle: 'Surgical removal of part or all of the colon', searchTerms: ['colectomy','colon resection','surgery','colon','bowel'] },
  { name: 'FOLFOX Chemotherapy Infusion', subtitle: 'Oxaliplatin + leucovorin + fluorouracil regimen', searchTerms: ['folfox','chemotherapy','infusion','oxaliplatin','fluorouracil','chemo'] },
  { name: 'FOLFIRI Chemotherapy Infusion', subtitle: 'Irinotecan + leucovorin + fluorouracil regimen', searchTerms: ['folfiri','chemotherapy','irinotecan','infusion','chemo'] },
  { name: 'Port Placement (PICC/Port-a-Cath)', subtitle: 'Central venous access device insertion', searchTerms: ['port','picc','central line','venous access','port placement'] },
  { name: 'Colonoscopy', subtitle: 'Endoscopic examination of the colon', searchTerms: ['colonoscopy','endoscopy','scope','colon exam'] },
  { name: 'Biopsy — Core Needle', subtitle: 'Tissue sampling with core needle', searchTerms: ['biopsy','core needle','tissue sample','needle biopsy'] },
  { name: 'Radiation Therapy (External Beam)', subtitle: 'EBRT to tumor site', searchTerms: ['radiation','radiotherapy','external beam','ebrt','xrt'] },
  { name: 'Immunotherapy Infusion', subtitle: 'Checkpoint inhibitor or monoclonal antibody', searchTerms: ['immunotherapy','infusion','checkpoint','pembrolizumab','nivolumab'] },
  { name: 'Liver Resection (Hepatectomy)', subtitle: 'Surgical removal of liver metastases', searchTerms: ['liver resection','hepatectomy','liver surgery','liver mets'] },
  { name: 'Lymph Node Dissection', subtitle: 'Surgical removal of regional lymph nodes', searchTerms: ['lymph node','lymphadenectomy','lymph dissection','lnd'] },
]
const SCAN_CATALOG = [
  { name: 'CT Chest/Abdomen/Pelvis w/ Contrast', subtitle: 'Full staging CT scan', searchTerms: ['ct scan','ct chest','ct abdomen','ct pelvis','staging ct','computed tomography'] },
  { name: 'PET-CT Scan', subtitle: 'Metabolic imaging for staging and response', searchTerms: ['pet ct','pet scan','fdg pet','positron emission'] },
  { name: 'MRI Abdomen/Pelvis', subtitle: 'Soft tissue assessment', searchTerms: ['mri','mri abdomen','mri pelvis','magnetic resonance'] },
  { name: 'CBC with Differential', subtitle: 'Complete blood count with cell types', searchTerms: ['cbc','complete blood count','differential','blood count','wbc','hgb'] },
  { name: 'Comprehensive Metabolic Panel', subtitle: 'Kidney, liver, electrolytes, glucose', searchTerms: ['cmp','metabolic panel','bmp','liver function','lft','kidney function'] },
  { name: 'CEA (Carcinoembryonic Antigen)', subtitle: 'Colorectal cancer tumor marker', searchTerms: ['cea','carcinoembryonic antigen','tumor marker','cea level'] },
  { name: 'Colonoscopy', subtitle: 'Surveillance endoscopy', searchTerms: ['colonoscopy','surveillance','scope','colon exam','endoscopy'] },
  { name: 'Pathology Report — Surgical Specimen', subtitle: 'Tissue pathology from surgical resection', searchTerms: ['pathology','pathology report','specimen','surgical pathology','histology'] },
  { name: 'MSI/MMR Testing', subtitle: 'Microsatellite instability and mismatch repair', searchTerms: ['msi','mmr','microsatellite','mismatch repair'] },
  { name: 'KRAS/NRAS/BRAF Mutation Testing', subtitle: 'Molecular biomarker panel', searchTerms: ['kras','nras','braf','mutation','molecular','biomarker','genomic'] },
  { name: 'Chest X-Ray', subtitle: 'Basic chest radiograph', searchTerms: ['chest xray','chest x-ray','cxr','radiograph'] },
  { name: 'Echocardiogram', subtitle: 'Cardiac ultrasound', searchTerms: ['echo','echocardiogram','cardiac ultrasound','heart ultrasound'] },
]
const MEDICATION_CATALOG = [
  { name: 'Oxaliplatin (Eloxatin)', subtitle: 'Platinum-based chemotherapy agent', isRegimen: false, searchTerms: ['oxaliplatin','eloxatin','platinum','chemo'] },
  { name: 'Leucovorin (Folinic Acid)', subtitle: 'Chemotherapy modulator', isRegimen: false, searchTerms: ['leucovorin','folinic acid','lv','citrovorum'] },
  { name: 'Fluorouracil (5-FU)', subtitle: 'Antimetabolite chemotherapy', isRegimen: false, searchTerms: ['5fu','fluorouracil','5-fluorouracil','antimetabolite'] },
  { name: 'Irinotecan (Camptosar)', subtitle: 'Topoisomerase I inhibitor', isRegimen: false, searchTerms: ['irinotecan','camptosar','topoisomerase','cpt-11'] },
  { name: 'Bevacizumab (Avastin)', subtitle: 'VEGF inhibitor — anti-angiogenic', isRegimen: false, searchTerms: ['bevacizumab','avastin','vegf','anti-vegf'] },
  { name: 'Cetuximab (Erbitux)', subtitle: 'EGFR inhibitor — for KRAS wild-type', isRegimen: false, searchTerms: ['cetuximab','erbitux','egfr','kras wt'] },
  { name: 'FOLFOX Regimen', subtitle: 'Oxaliplatin + leucovorin + 5-FU', isRegimen: true, searchTerms: ['folfox','regimen','oxaliplatin','leucovorin','5fu'] },
  { name: 'FOLFIRI Regimen', subtitle: 'Irinotecan + leucovorin + 5-FU', isRegimen: true, searchTerms: ['folfiri','regimen','irinotecan','leucovorin'] },
  { name: 'Ondansetron (Zofran)', subtitle: 'Antiemetic — nausea and vomiting', isRegimen: false, searchTerms: ['ondansetron','zofran','antiemetic','nausea'] },
  { name: 'Dexamethasone', subtitle: 'Corticosteroid — anti-inflammatory', isRegimen: false, searchTerms: ['dexamethasone','decadron','steroid','corticosteroid'] },
  { name: 'Filgrastim (Neupogen)', subtitle: 'G-CSF — white blood cell stimulator', isRegimen: false, searchTerms: ['filgrastim','neupogen','gcsf','g-csf','neulasta'] },
  { name: 'Duloxetine (Cymbalta)', subtitle: 'For chemotherapy-induced neuropathy', isRegimen: false, searchTerms: ['duloxetine','cymbalta','neuropathy','snri'] },
]

const PROC_SUGGESTED = PROCEDURE_CATALOG.slice(0, 3)
const SCAN_SUGGESTED = SCAN_CATALOG.slice(0, 3)
const MED_SUGGESTED = MEDICATION_CATALOG.slice(0, 3)

const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

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

const railIcon = (type) => {
  if (type === 'diagnosis') return <Ico.diagnosisRail/>
  if (type === 'medication') return <Ico.medicationRail/>
  if (type === 'scan') return <Ico.scanRail/>
  return <Ico.procedureRail/>
}

const typeLabel = { procedure: 'Procedure/Surgery', medication: 'Medication', scan: 'Scan/Lab', diagnosis: 'Diagnosis' }
const typeColor = { procedure: C.textSecondary, medication: C.textSecondary, scan: C.textSecondary, diagnosis: C.textSecondary }

// ─── PRIMITIVES ───────────────────────────────────────────────────
const StatusBar = ({ light }) => (
  <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', flexShrink: 0 }}>
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

const DockedButton = ({ label, onClick, disabled, secondaryLabel, onSecondary }) => (
  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, borderTop: `1px solid ${C.border}`, padding: '12px 20px 30px' }}>
    {secondaryLabel && (
      <button onClick={onSecondary} style={{ width: '100%', height: 48, borderRadius: 9999, backgroundColor: C.bgApp, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: C.primary, marginBottom: 10 }}>
        {secondaryLabel}
      </button>
    )}
    <button onClick={!disabled ? onClick : undefined} style={{ width: '100%', height: 52, borderRadius: 9999, backgroundColor: C.primary, border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 16, fontWeight: 600, color: 'white', position: 'relative', overflow: 'hidden' }}>
      {label}
      {disabled && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.42)', borderRadius: 9999 }}/>}
    </button>
  </div>
)

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

const DateInputField = ({ label, value, onChange, required }) => {
  const [on, setOn] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 5 }}>{label}{required && <span style={{ color: C.primary }}> *</span>}</div>
      <div style={{ position: 'relative', border: on ? `2px solid ${C.primary}` : `1px solid rgba(0,0,0,0.22)`, borderRadius: 10, padding: '12px', display: 'flex', alignItems: 'center', backgroundColor: C.bgCard }}>
        <input type="date" value={value} onChange={e => onChange(e.target.value)} onFocus={() => setOn(true)} onBlur={() => setOn(false)} style={{ fontSize: 16, color: value ? C.textPrimary : C.textTertiary, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter,sans-serif', flex: 1, zIndex: 1, position: 'relative' }}/>
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

// ─── CATALOG SEARCH STEP ──────────────────────────────────────────
const CatalogSearchStep = ({ title, catalog, suggested, onSelect, onClose, onBack }) => {
  const [q, setQ] = useState('')
  const lower = q.toLowerCase().trim()
  const filtered = lower ? catalog.filter(i => i.name.toLowerCase().includes(lower) || i.searchTerms.some(t => t.includes(lower))) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: C.bgApp }}>
      <StatusBar/>
      <NavBar title={title} onBack={onBack} onClose={onClose} bg={C.bgApp}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, marginBottom: 16, lineHeight: '30px' }}>{title}</div>
        <SearchInput value={q} onChange={setQ}/>
        <div style={{ height: 20 }}/>

        {!lower && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Suggested based on diagnosis</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggested.map((item, i) => (
                <button key={i} onClick={() => onSelect(item)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
                  <div>
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
                <div>
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
            <button onClick={() => onSelect({ name: q, subtitle: 'Custom entry', searchTerms: [lower], isRegimen: false })} style={{ padding: '11px 22px', backgroundColor: C.bgCard, border: `1.5px solid ${C.primary}`, borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: C.primary }}>
              Add "{q}"
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FLOWS ────────────────────────────────────────────────────────
const useSlide = (onClose) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 300) }
  const style = { position: 'absolute', inset: 0, backgroundColor: C.bgApp, transform: vis ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease', zIndex: 60, display: 'flex', flexDirection: 'column' }
  return { dismiss, style }
}

const AddProcedureFlow = ({ onClose, onComplete }) => {
  const { dismiss, style } = useSlide(onClose)
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState(null)
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const finish = () => { onComplete({ type: 'procedure', name: sel.name, date, notes, id: `proc-${Date.now()}` }); dismiss() }
  if (step === 0) return <div style={style}><CatalogSearchStep title="Add a procedure or surgery" catalog={PROCEDURE_CATALOG} suggested={PROC_SUGGESTED} onSelect={i => { setSel(i); setStep(1) }} onClose={dismiss} onBack={dismiss}/></div>
  if (step === 1) return (
    <div style={style}>
      <StatusBar/><NavBar title="When did this happen?" subtitle={sel?.name} onBack={() => setStep(0)} onClose={dismiss} bg={C.bgApp}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 120px' }}>
        <DateInputField label="Procedure date" value={date} onChange={setDate} required/>
      </div>
      <DockedButton label="Next" onClick={() => setStep(2)} disabled={!date}/>
    </div>
  )
  return (
    <div style={style}>
      <StatusBar/><NavBar title="Any notes?" subtitle={sel?.name} onBack={() => setStep(1)} onClose={dismiss} bg={C.bgApp}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 120px' }}>
        <NotesTextarea value={notes} onChange={setNotes} placeholder="e.g. Recovery went well. Follow-up in 6 weeks."/>
      </div>
      <DockedButton label="Add to plan" onClick={finish}/>
    </div>
  )
}

const AddScanFlow = ({ onClose, onComplete }) => {
  const { dismiss, style } = useSlide(onClose)
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState(null)
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const finish = () => { onComplete({ type: 'scan', name: sel.name, date, notes, id: `scan-${Date.now()}` }); dismiss() }
  if (step === 0) return <div style={style}><CatalogSearchStep title="Add a scan, lab, or test" catalog={SCAN_CATALOG} suggested={SCAN_SUGGESTED} onSelect={i => { setSel(i); setStep(1) }} onClose={dismiss} onBack={dismiss}/></div>
  if (step === 1) return (
    <div style={style}>
      <StatusBar/><NavBar title="When was this test?" subtitle={sel?.name} onBack={() => setStep(0)} onClose={dismiss} bg={C.bgApp}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 120px' }}>
        <DateInputField label="Test date" value={date} onChange={setDate} required/>
      </div>
      <DockedButton label="Next" onClick={() => setStep(2)} disabled={!date}/>
    </div>
  )
  return (
    <div style={style}>
      <StatusBar/><NavBar title="Any notes?" subtitle={sel?.name} onBack={() => setStep(1)} onClose={dismiss} bg={C.bgApp}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 120px' }}>
        <NotesTextarea value={notes} onChange={setNotes} placeholder="e.g. Awaiting radiologist report."/>
      </div>
      <DockedButton label="Add to plan" onClick={finish}/>
    </div>
  )
}

const AddMedicationFlow = ({ onClose, onComplete }) => {
  const { dismiss, style } = useSlide(onClose)
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState(null)
  const [dose, setDose] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const finish = () => { onComplete({ type: 'medication', name: sel.name, dose, startDate: start, endDate: end, notes, isRegimen: sel.isRegimen || false, date: start, id: `med-${Date.now()}` }); dismiss() }
  if (step === 0) return <div style={style}><CatalogSearchStep title="Add a medication" catalog={MEDICATION_CATALOG} suggested={MED_SUGGESTED} onSelect={i => { setSel(i); setStep(1) }} onClose={dismiss} onBack={dismiss}/></div>
  if (step === 1) return (
    <div style={style}>
      <StatusBar/><NavBar title={sel?.isRegimen ? 'Schedule' : 'Dose & schedule'} subtitle={sel?.name} onBack={() => setStep(0)} onClose={dismiss} bg={C.bgApp}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 140px' }}>
        <NotesTextarea value={dose} onChange={setDose} placeholder={sel?.isRegimen ? 'e.g. Every 2 weeks, 14-day cycles' : 'e.g. 500mg twice daily with food'}/>
      </div>
      <DockedButton label="Next" onClick={() => setStep(2)} secondaryLabel="Skip" onSecondary={() => setStep(2)}/>
    </div>
  )
  if (step === 2) return (
    <div style={style}>
      <StatusBar/><NavBar title="Duration" subtitle={sel?.name} onBack={() => setStep(1)} onClose={dismiss} bg={C.bgApp}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 120px' }}>
        <DateInputField label="Start date" value={start} onChange={setStart} required/>
        <DateInputField label="End date (if known)" value={end} onChange={setEnd}/>
      </div>
      <DockedButton label="Next" onClick={() => setStep(3)} disabled={!start}/>
    </div>
  )
  return (
    <div style={style}>
      <StatusBar/><NavBar title="Any notes?" subtitle={sel?.name} onBack={() => setStep(2)} onClose={dismiss} bg={C.bgApp}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 120px' }}>
        <NotesTextarea value={notes} onChange={setNotes} placeholder="e.g. Prescribed by Dr. Patel. Monitor for neuropathy."/>
      </div>
      <DockedButton label="Add to plan" onClick={finish}/>
    </div>
  )
}

// ─── TIMELINE CARDS ───────────────────────────────────────────────

// Daily AI Summary card
const DailySummaryCard = ({ summary, isToday }) => {
  const [open, setOpen] = useState(false)
  const bg = isToday ? C.primaryLight : C.bgCard
  const bdr = isToday ? 'rgba(255,121,88,0.2)' : C.border
  return (
    <button onClick={() => setOpen(o => !o)} style={{ width: '100%', backgroundColor: bg, border: `1px solid ${bdr}`, borderRadius: 13, padding: '13px 15px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ico.spark/>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, flex: 1 }}>Daily AI Summary</span>
        <Ico.chevDown open={open}/>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${bdr}` }}>
          <p style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.65, marginBottom: 14 }}>{summary.text}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textTertiary, flex: 1 }}>Helpful?</span>
            <button onClick={e => e.stopPropagation()} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, cursor: 'pointer' }}><Ico.thumbUp/></button>
            <button onClick={e => e.stopPropagation()} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, cursor: 'pointer' }}><Ico.thumbDown/></button>
          </div>
        </div>
      )}
    </button>
  )
}

// Individual event card — matches design closely
const EventCard = ({ event }) => {
  const [open, setOpen] = useState(false)
  const label = typeLabel[event.type] || 'Event'
  return (
    <button onClick={() => setOpen(o => !o)} style={{ width: '100%', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 13, padding: '13px 15px', cursor: 'pointer', textAlign: 'left' }}>
      {/* Header row: type label + date + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {event.date && <span style={{ fontSize: 12, color: C.textTertiary }}>{fmtDate(event.date)}</span>}
          <Ico.chevRight/>
        </div>
      </div>
      {/* Name */}
      <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, lineHeight: 1.3, marginBottom: event.details || event.dose ? 5 : 0 }}>{event.name}</div>
      {/* Clinical details (diagnosis) */}
      {event.details && (
        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>{event.details.join(' · ')}</div>
      )}
      {/* Dose (medication) */}
      {event.dose && <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{event.dose}</div>}
      {/* Notes row */}
      {event.notes && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
          <div style={{ marginTop: 2, flexShrink: 0 }}><Ico.notes/></div>
          <span style={{ fontSize: 13, color: C.textTertiary, lineHeight: 1.5 }}>{event.notes}</span>
        </div>
      )}
      {/* Expanded: extra metadata */}
      {open && (event.startDate || event.endDate) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          {event.startDate && <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}><span style={{ color: C.textTertiary }}>Started </span>{fmtDate(event.startDate)}</div>}
          {event.endDate && <div style={{ fontSize: 12, color: C.textSecondary }}><span style={{ color: C.textTertiary }}>Ended </span>{fmtDate(event.endDate)}</div>}
        </div>
      )}
    </button>
  )
}

// Suggested treatments block — matches the design pattern exactly
const SuggestedBlock = ({ block }) => {
  const [open, setOpen] = useState(true)
  return (
    <div>
      {/* Section header row — always visible */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: open ? 10 : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 2 }}>Suggested Treatments</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{block.stepLabel}</div>
          {open && <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 3, lineHeight: 1.5 }}>{block.stepBody}</div>}
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 10, marginTop: 2 }}>
          <Ico.chevDown open={open}/>
        </button>
      </div>
      {/* Option cards */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {block.options.map(opt => (
            <button key={opt.id} style={{ width: '100%', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 13, padding: '13px 15px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>{opt.title}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45 }}>{opt.description}</div>
              </div>
              <Ico.chevRight/>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── DAY SECTION ─────────────────────────────────────────────────
// The key structural insight from the design:
// - Date label is large bold text, full-width, NOT in a column
// - Cards live in the main content area, right of the rail line
// - Icon badges sit ON the rail line, vertically centered with their card

const RailItem = ({ icon, isToday, isLast, card }) => {
  const lineColor = isToday ? C.timelineLineToday : C.timelineLine
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 10 }}>
      {/* Rail column */}
      <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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

const DaySection = ({ day }) => {
  // Combine all rail items: summary first, then events, then suggested
  const allItems = []

  if (day.summary) {
    allItems.push({ key: 'summary', icon: null, card: <DailySummaryCard summary={day.summary} isToday={day.isToday}/> })
  }
  day.events.forEach(ev => {
    allItems.push({ key: ev.id, icon: railIcon(ev.type), card: <EventCard event={ev}/> })
  })
  if (day.suggested) {
    allItems.push({ key: 'suggested', icon: <Ico.suggestedRail/>, card: <SuggestedBlock block={day.suggested}/> })
  }

  const lineColor = day.isToday ? C.timelineLineToday : C.timelineLine

  return (
    <div style={{ backgroundColor: C.bgApp, paddingBottom: 4 }}>
      {/* Date header — large bold, full width */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.3px' }}>
          {day.isToday ? 'Today' : day.label}
        </span>
        {day.isToday && <span style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary }}>·</span>}
        {day.isToday && <span style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary }}>{day.label}</span>}
      </div>

      {/* Rail + cards */}
      <div style={{ paddingLeft: 20, paddingRight: 16 }}>
        {/* Continuous line behind everything */}
        <div style={{ position: 'relative' }}>
          {/* Vertical line that runs behind all items */}
          <div style={{ position: 'absolute', left: 21, top: 0, bottom: 0, width: 2, backgroundColor: lineColor }}/>

          {allItems.map((item, i) => {
            const isLast = i === allItems.length - 1
            if (!item.icon) {
              // Summary card: no badge, just indent past rail
              return (
                <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 44, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>{item.card}</div>
                </div>
              )
            }
            return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 10 }}>
                {/* Icon badge centered on rail */}
                <div style={{ width: 44, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 2, zIndex: 1, position: 'relative' }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>{item.card}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── ADD EVENT SHEET ──────────────────────────────────────────────
const AddEventSheet = ({ onClose, onSelectProcedure, onSelectScan, onSelectMedication }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, [])
  const dismiss = () => { setVis(false); setTimeout(onClose, 300) }

  const opts = [
    { emoji: '🩺', label: 'Procedure or Surgery', desc: 'A procedure or surgery you had or have scheduled', fn: onSelectProcedure },
    { emoji: '💊', label: 'Medication Treatment', desc: 'Start, stop, or adjust a medication', fn: onSelectMedication },
    { emoji: '🔬', label: 'Scan, lab, or pathology test', desc: 'A test that was ordered, completed, or scheduled', fn: onSelectScan },
  ]

  return (
    <>
      <div onClick={dismiss} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 50 }}/>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, borderRadius: '18px 18px 0 0', zIndex: 51, transform: vis ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s ease', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '12px auto 0' }}/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 6px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>What would you like to add?</div>
          <button onClick={dismiss} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><Ico.close/></button>
        </div>
        <div style={{ paddingBottom: 34 }}>
          {opts.map((o, i) => (
            <button key={i} onClick={o.fn} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 20px', background: 'none', border: 'none', borderBottom: i < opts.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{o.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{o.label}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{o.desc}</div>
              </div>
              <Ico.chevRight/>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── TOAST ────────────────────────────────────────────────────────
const Toast = ({ message, onDone }) => {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
    const t1 = setTimeout(() => setVis(false), 2200)
    const t2 = setTimeout(onDone, 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  return (
    <div style={{ position: 'absolute', bottom: 96, left: '50%', transform: `translateX(-50%) translateY(${vis ? 0 : 10}px)`, backgroundColor: 'rgba(30,30,30,0.88)', color: 'white', padding: '9px 18px', borderRadius: 9999, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', opacity: vis ? 1 : 0, transition: 'opacity 0.25s, transform 0.25s', zIndex: 100, pointerEvents: 'none' }}>
      ✓ {message}
    </div>
  )
}

// ─── APP HEADER ───────────────────────────────────────────────────
const AppHeader = () => {
  const r = 19, circ = 2 * Math.PI * r, dash = 0.62 * circ
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 20px 12px', backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}` }}>
      {/* Avatar with progress ring — left aligned, matches design */}
      <div style={{ position: 'relative', width: 46, height: 46, marginRight: 16 }}>
        <svg width="46" height="46" viewBox="0 0 46 46">
          <circle cx="23" cy="23" r={r} fill="none" stroke="#e8e8e8" strokeWidth="3"/>
          <circle cx="23" cy="23" r={r} fill="none" stroke="#4ade80" strokeWidth="3" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 23 23)"/>
        </svg>
        {/* Person icon inside circle */}
        <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="3.5" stroke="#666" strokeWidth="1.5"/>
            <path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
      {/* Title — centered in remaining space */}
      <div style={{ flex: 1, textAlign: 'center', marginRight: 46 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Treatment</div>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────
export default function App() {
  const [timeline, setTimeline] = useState(INITIAL_TIMELINE)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [flow, setFlow] = useState(null)
  const [toast, setToast] = useState(null)

  const openFlow = (type) => { setSheetOpen(false); setTimeout(() => setFlow(type), 310) }

  const handleComplete = (event) => {
    const dateKey = event.date || event.startDate || new Date().toISOString().split('T')[0]
    setTimeline(prev => {
      const existing = prev.find(d => d.date === dateKey)
      if (existing) return prev.map(d => d.date === dateKey ? { ...d, events: [...d.events, event] } : d)
      const d = new Date(dateKey + 'T12:00:00')
      return [...prev, { date: dateKey, label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }), isToday: false, summary: null, events: [event], suggested: null }].sort((a, b) => a.date.localeCompare(b.date))
    })
    setFlow(null)
    setTimeout(() => setToast('Added to your plan'), 350)
  }

  return (
    <div style={{ width: 390, height: 844, backgroundColor: C.bgApp, position: 'relative', overflow: 'hidden', borderRadius: 44, boxShadow: '0 24px 64px rgba(0,0,0,0.26)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <StatusBar/>
        <AppHeader/>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {timeline.map(day => <DaySection key={day.date} day={day}/>)}
          <div style={{ height: 96 }}/>
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => setSheetOpen(true)} style={{ position: 'absolute', bottom: 34, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: C.primary, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px rgba(255,121,88,0.42)', zIndex: 40 }}>
        <Ico.plus/>
      </button>

      {sheetOpen && <AddEventSheet onClose={() => setSheetOpen(false)} onSelectProcedure={() => openFlow('procedure')} onSelectScan={() => openFlow('scan')} onSelectMedication={() => openFlow('medication')}/>}
      {flow === 'procedure' && <AddProcedureFlow onClose={() => setFlow(null)} onComplete={handleComplete}/>}
      {flow === 'scan' && <AddScanFlow onClose={() => setFlow(null)} onComplete={handleComplete}/>}
      {flow === 'medication' && <AddMedicationFlow onClose={() => setFlow(null)} onComplete={handleComplete}/>}
      {toast && <Toast message={toast} onDone={() => setToast(null)}/>}
    </div>
  )
}
