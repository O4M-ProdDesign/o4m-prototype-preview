export const REGIMEN_DETAIL_DATA = {

  // Pembrolizumab adjuvant
  'pembro-adjuv': {
    name: 'Pembrolizumab 400mg Q6W',
    category: 'Adjuvant immunotherapy · NCCN Category 1',
    type: 'medication',
    overview: 'An immunotherapy drug given by IV infusion every 6 weeks for approximately 12 months after surgery. Based on results from the KEYNOTE-564 trial.',
    whatItInvolves: [
      'You visit an infusion centre every 6 weeks for an IV infusion.',
      'Each infusion takes about 30 minutes once the IV is set up.',
      'No port is required — a standard IV line is used.',
      'Treatment continues for 17 cycles, approximately 12 months in total.',
    ],
    administration: 'Outpatient infusion centre. IV infusion over 30 minutes every 6 weeks. No port or PICC required.',
    whatToExpect: [
      'Most infusions are well tolerated. Many people work and carry on normal activities throughout treatment.',
      'Fatigue is the most commonly reported side effect. Peaks in the first few cycles for many people.',
      'You will have blood tests before each cycle to check for immune-related changes.',
      'Immune-related side effects can develop at any time — report any new symptoms promptly.',
    ],
    schedule: '400mg IV every 6 weeks × 17 cycles (approximately 12 months).',
    components: [
      { name: 'Pembrolizumab (Keytruda)', dose: '400mg', schedule: 'IV infusion every 6 weeks', role: 'A PD-1 inhibitor that removes a "brake" on the immune system, helping it recognise and attack cancer cells.' },
    ],
    sideEffects: [
      { name: 'Fatigue', severity: 'Common', detail: 'Most people notice some fatigue, particularly in the first few cycles. Usually manageable.' },
      { name: 'Skin rash or itching', severity: 'Common', detail: 'Often mild. Topical treatments usually help. Tell your team if it spreads or becomes severe.' },
      { name: 'Immune-related side effects', severity: 'Monitor', detail: 'The immune system can affect any organ. Thyroid, liver, lung, and bowel are most common. Prompt reporting of new symptoms is important.' },
      { name: 'Joint pain', severity: 'Less common', detail: 'Immune-related joint inflammation. Usually responds to treatment if caught early.' },
    ],
    monitoring: [
      'Blood count and metabolic panel before each cycle',
      'Thyroid function every 2–3 cycles',
      'Imaging scans per surveillance schedule',
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024. KEYNOTE-564.',
  },

  // First-line regimens
  'fl-nivo-cabo': {
    name: 'Nivolumab + Cabozantinib',
    category: 'First-line systemic therapy · NCCN Category 1',
    type: 'medication',
    overview: 'A combination of an immunotherapy (nivolumab) and an oral targeted therapy (cabozantinib). One of the most commonly recommended first-line options for metastatic clear cell RCC.',
    whatItInvolves: [
      'Nivolumab is given as an IV infusion every 2 or 4 weeks at an infusion centre.',
      'Cabozantinib is taken as a daily oral tablet at home.',
      'No port is required — standard IV access for infusions.',
      'Treatment continues until the cancer progresses or side effects become unmanageable.',
    ],
    administration: 'Nivolumab: outpatient infusion centre. Cabozantinib: oral tablet at home daily.',
    whatToExpect: [
      'Infusion days are typically 2–3 hour visits including prep and monitoring time.',
      'Cabozantinib tablets are taken every day, with or without food.',
      'Fatigue and hand-foot syndrome are common in the first weeks of cabozantinib.',
      'Nivolumab infusions are generally well tolerated but can cause immune-related side effects.',
    ],
    schedule: 'Nivolumab 240mg Q2W or 480mg Q4W. Cabozantinib 40mg oral daily. Continuous until progression.',
    components: [
      { name: 'Nivolumab (Opdivo)', dose: '240mg Q2W or 480mg Q4W', schedule: 'IV infusion every 2 or 4 weeks', role: 'PD-1 immunotherapy that helps the immune system attack cancer cells.' },
      { name: 'Cabozantinib (Cabometyx)', dose: '40mg daily', schedule: 'Oral tablet, taken daily', role: 'Targets blood vessel growth (VEGF) and other pathways that cancer uses to grow and spread.' },
    ],
    sideEffects: [
      { name: 'Fatigue', severity: 'Common', detail: 'From both agents. Usually most prominent in the first month.' },
      { name: 'Hand-foot syndrome', severity: 'Common', detail: 'Redness, tenderness on palms and soles from cabozantinib. Moisturise daily.' },
      { name: 'Hypertension', severity: 'Monitor', detail: 'Cabozantinib can raise blood pressure. Monitored at each visit.' },
      { name: 'Immune-related side effects', severity: 'Monitor', detail: 'Nivolumab can cause immune inflammation in any organ. Report new symptoms promptly.' },
      { name: 'Diarrhoea', severity: 'Common', detail: 'Can occur from either agent. Usually manageable with diet adjustments and medication.' },
    ],
    monitoring: [
      'Blood pressure check at each visit',
      'Blood count and metabolic panel before each infusion',
      'Thyroid function every 2–3 cycles',
      'Imaging every 8–12 weeks',
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024. CheckMate 9ER.',
  },

  'fl-pembro-axitinib': {
    name: 'Pembrolizumab + Axitinib',
    category: 'First-line systemic therapy · NCCN Category 1',
    type: 'medication',
    overview: 'A combination of immunotherapy (pembrolizumab) and oral targeted therapy (axitinib). Demonstrated improved survival in the KEYNOTE-426 trial.',
    whatItInvolves: [
      'Pembrolizumab is given as an IV infusion every 3 weeks at an infusion centre.',
      'Axitinib is taken as an oral tablet twice daily at home.',
      'No port required. Each infusion visit is approximately 1–2 hours.',
    ],
    administration: 'Pembrolizumab: outpatient infusion. Axitinib: oral tablet twice daily at home.',
    whatToExpect: [
      'Twice-daily axitinib dosing requires a consistent routine — take with or without food at the same times each day.',
      'Fatigue and hypertension are the most common early side effects from axitinib.',
      'Infusion days with pembrolizumab are typically well tolerated.',
    ],
    schedule: 'Pembrolizumab 200mg Q3W. Axitinib 5mg oral twice daily. Continuous until progression.',
    components: [
      { name: 'Pembrolizumab (Keytruda)', dose: '200mg', schedule: 'IV every 3 weeks', role: 'PD-1 immunotherapy to help the immune system target cancer.' },
      { name: 'Axitinib (Inlyta)', dose: '5mg twice daily', schedule: 'Oral tablet, twice daily', role: 'VEGF inhibitor that blocks blood supply to tumors.' },
    ],
    sideEffects: [
      { name: 'Hypertension', severity: 'Common', detail: 'From axitinib. Monitored at each visit. Usually managed with medication.' },
      { name: 'Fatigue', severity: 'Common', detail: 'From both agents.' },
      { name: 'Diarrhoea', severity: 'Common', detail: 'Usually manageable.' },
      { name: 'Immune-related side effects', severity: 'Monitor', detail: 'From pembrolizumab. Can affect any organ.' },
    ],
    monitoring: [
      'Blood pressure at each visit',
      'Blood count and metabolic panel before each infusion',
      'Thyroid function every few cycles',
      'Imaging every 8–12 weeks',
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024. KEYNOTE-426.',
  },

  'fl-nivo-ipi': {
    name: 'Nivolumab + Ipilimumab',
    category: 'First-line systemic therapy · NCCN Category 1 (intermediate/poor risk)',
    type: 'medication',
    overview: 'A dual immunotherapy combination. Ipilimumab is given for 4 doses alongside nivolumab, then nivolumab continues alone as maintenance. Based on CheckMate 214.',
    whatItInvolves: [
      'Both drugs are given as IV infusions every 3 weeks for the first 4 cycles (approximately 12 weeks).',
      'After 4 doses, ipilimumab stops and nivolumab continues alone every 2 or 4 weeks.',
      'No port is typically required. Each visit is 2–4 hours.',
      'The combination phase has higher rates of immune-related side effects than either drug alone.',
    ],
    administration: 'Outpatient infusion centre. Induction: Q3W × 4 cycles. Maintenance: nivolumab Q2W or Q4W.',
    whatToExpect: [
      'The first 4 cycles (combination phase) carry the highest risk of immune side effects.',
      'After ipilimumab stops, most people tolerate nivolumab maintenance well.',
      'Fatigue, skin changes, and diarrhoea are most common in the induction phase.',
      'Immune-related toxicity requires prompt attention — contact your team for any new symptoms.',
    ],
    schedule: 'Induction: nivolumab 3mg/kg + ipilimumab 1mg/kg Q3W × 4 cycles. Maintenance: nivolumab 240mg Q2W or 480mg Q4W.',
    components: [
      { name: 'Nivolumab (Opdivo)', dose: '3mg/kg (induction), then 240mg or 480mg', schedule: 'Q3W induction, then Q2W or Q4W maintenance', role: 'PD-1 inhibitor immunotherapy.' },
      { name: 'Ipilimumab (Yervoy)', dose: '1mg/kg', schedule: 'Q3W × 4 doses only', role: 'CTLA-4 inhibitor. Works with nivolumab to activate the immune system more broadly.' },
    ],
    sideEffects: [
      { name: 'Immune-related side effects', severity: 'Monitor', detail: 'Higher risk with dual immunotherapy than single agent. Can affect skin, gut, liver, lungs, endocrine glands. Prompt reporting essential.' },
      { name: 'Diarrhoea / colitis', severity: 'Monitor', detail: 'More common with ipilimumab. Report more than 4 loose stools per day.' },
      { name: 'Fatigue', severity: 'Common', detail: 'Can be significant during induction phase.' },
      { name: 'Skin rash', severity: 'Common', detail: 'Often mild. Topical treatment usually helps.' },
    ],
    monitoring: [
      'Blood count and metabolic panel before every cycle',
      'Liver function tests before every cycle',
      'Thyroid and other endocrine labs regularly',
      'Imaging every 8–12 weeks',
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024. CheckMate 214.',
  },

  // Subsequent therapy — prior IO
  'sub-io-cabo': {
    name: 'Cabozantinib',
    category: 'Subsequent systemic therapy · NCCN Category 1',
    type: 'medication',
    overview: 'An oral targeted therapy taken daily at home. One of the preferred options after prior immunotherapy-based treatment.',
    whatItInvolves: [
      'A single daily oral tablet taken at home, with or without food.',
      'No infusion visits required — clinic visits are for monitoring only.',
      'Blood pressure monitoring at home may be recommended.',
    ],
    administration: 'Oral tablet taken daily at home. Clinic visits for monitoring every 4–8 weeks.',
    whatToExpect: [
      'Hand-foot syndrome (redness, tenderness on palms and soles) often develops in the first few weeks — moisturise daily.',
      'Fatigue and appetite changes are common early on.',
      'Blood pressure often rises on cabozantinib. Your team will monitor and manage this.',
      'Dose reductions are common and do not mean the treatment is failing.',
    ],
    schedule: '60mg oral daily. Continuous until progression. Dose reductions to 40mg or 20mg if needed.',
    components: [
      { name: 'Cabozantinib (Cabometyx)', dose: '60mg daily', schedule: 'Oral tablet, once daily', role: 'Targets VEGFR, MET, and AXL pathways that cancer uses to grow, spread, and resist treatment.' },
    ],
    sideEffects: [
      { name: 'Hand-foot syndrome', severity: 'Common', detail: 'Redness, blistering, tenderness on palms and soles. Moisturise daily. Dose adjustments can help.' },
      { name: 'Hypertension', severity: 'Monitor', detail: 'Often develops early. Usually managed with medication.' },
      { name: 'Fatigue', severity: 'Common', detail: 'Usually manageable. Most pronounced in the first month.' },
      { name: 'Diarrhoea', severity: 'Common', detail: 'Usually mild to moderate. Keep loperamide available.' },
      { name: 'Liver enzyme elevation', severity: 'Monitor', detail: 'Monitored with regular blood tests.' },
    ],
    monitoring: [
      'Blood pressure monitoring — home and clinic',
      'Blood count and metabolic panel every 4 weeks initially',
      'Liver function tests regularly',
      'Imaging every 8–12 weeks',
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  // Subsequent therapy — IO naïve
  'sub-nv-nivo': {
    name: 'Nivolumab (monotherapy)',
    category: 'Subsequent systemic therapy · NCCN Category 1',
    type: 'medication',
    overview: 'An immunotherapy given by IV infusion. The preferred option when no prior immunotherapy has been used. Based on the CheckMate 025 trial.',
    whatItInvolves: [
      'IV infusion at an infusion centre every 2 or 4 weeks.',
      'Each visit takes approximately 1–2 hours including prep and monitoring.',
      'No port required. No daily tablets to take at home.',
    ],
    administration: 'Outpatient infusion centre. 240mg Q2W or 480mg Q4W. No port required.',
    whatToExpect: [
      'Most infusions are well tolerated. Many people maintain normal daily activities.',
      'Fatigue is the most commonly reported side effect.',
      'Immune-related side effects can develop at any time — report new symptoms promptly to your care team.',
      'Response to immunotherapy can take several months to assess.',
    ],
    schedule: '240mg IV every 2 weeks or 480mg every 4 weeks. Continuous until progression.',
    components: [
      { name: 'Nivolumab (Opdivo)', dose: '240mg Q2W or 480mg Q4W', schedule: 'IV infusion every 2 or 4 weeks', role: 'PD-1 inhibitor that removes a brake on the immune system, helping it attack cancer cells.' },
    ],
    sideEffects: [
      { name: 'Fatigue', severity: 'Common', detail: 'Usually mild to moderate.' },
      { name: 'Skin rash or itching', severity: 'Common', detail: 'Often mild. Topical treatments usually help.' },
      { name: 'Immune-related side effects', severity: 'Monitor', detail: 'Can affect any organ. Thyroid, liver, lung, and gut are most common. Prompt reporting is essential.' },
      { name: 'Thyroid dysfunction', severity: 'Common', detail: 'Often manageable with thyroid hormone replacement.' },
    ],
    monitoring: [
      'Blood count and metabolic panel before each infusion',
      'Thyroid function every 2–3 cycles',
      'Imaging every 8–12 weeks',
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024. CheckMate 025.',
  },
}
