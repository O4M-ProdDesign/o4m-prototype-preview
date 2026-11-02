import { TREATMENT_DETAIL_DATA } from '../data/treatmentDetails.js'
import { REGIMEN_DETAIL_DATA } from '../data/regimenDetails.js'

// ─── TREATMENT DETAIL LOOKUP ──────────────────────────────────────
// Returns detail data for a treatment set option.
// Falls back to generic content when no specific entry exists.
export const getDetailData = (opt) => {
  const key = opt?.id
  if (TREATMENT_DETAIL_DATA[key]) {
    return { ...TREATMENT_DETAIL_DATA[key], title: opt.title || TREATMENT_DETAIL_DATA[key].title }
  }
  return {
    type: 'medication',
    title: opt?.title || 'Treatment Option',
    clinicalClass: 'Recommended treatment · NCCN Guidelines',
    description: opt?.description || 'This treatment has been identified as relevant to your diagnosis and current treatment stage.',
    whyRecommended: [
      'Consistent with your diagnosis and disease stage',
      'Recommended by clinical practice guidelines',
      'Appropriate based on your current treatment history',
    ],
    overview: [
      { label: 'Mechanism', detail: 'Works by targeting specific pathways involved in cancer cell growth and division' },
      { label: 'Administration', detail: 'Discuss timing, dosing, and schedule with your oncology team' },
    ],
    goals: [
      'Target cancer cells based on your specific disease profile',
      'Improve treatment outcomes',
      'Minimise impact on quality of life',
    ],
    regimens: [
      { id: 'r1', name: opt?.title || 'Standard regimen', category: 'Preferred Regimen', preferred: true, description: 'Discuss specific dosing and scheduling with your oncology team.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology. Referenced for educational purposes.',
  }
}

// ─── REGIMEN DETAIL LOOKUP ────────────────────────────────────────
// Returns detail data for a specific regimen.
// Falls back to generic content when no specific entry exists.
export const getRegimenData = (reg) => {
  if (REGIMEN_DETAIL_DATA[reg?.id]) return REGIMEN_DETAIL_DATA[reg.id]
  return {
    name: reg?.name || 'Regimen',
    category: reg?.category || 'Recommended Regimen',
    type: 'medication',
    overview: reg?.description || 'Discuss specific dosing, scheduling, and administration details with your oncology team.',
    whatItInvolves: [],
    administration: 'Administration details will be provided by your oncology team.',
    whatToExpect: [],
    components: [],
    schedule: 'Discuss scheduling with your oncology team.',
    sideEffects: [],
    monitoring: [],
    source: 'NCCN Clinical Practice Guidelines in Oncology.',
  }
}
