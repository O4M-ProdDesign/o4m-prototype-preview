export const TREATMENT_DETAIL_DATA = {

  // ── PRIMARY TREATMENT: STAGE I–III ───────────────────────────────

  'RCC_RCTS_PARTIAL_NEPHRECTOMY': {
    type: 'procedure',
    title: 'Partial nephrectomy (surgery)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'Surgery to remove only the part of the kidney containing the tumor, while preserving as much healthy kidney tissue as possible.',
    goals: [
      'Remove the tumor completely with clear margins',
      'Preserve kidney function for the long term',
      'Reduce the risk of cancer returning',
    ],
    overview: [
      { label: 'Recovery time', detail: 'Most people go home within 1–3 days. Full recovery typically takes 2–4 weeks for laparoscopic surgery.' },
      { label: 'Kidney function', detail: 'Preserving part of the kidney helps maintain long-term kidney health, which matters for overall health outcomes.' },
      { label: 'Surgical approach', detail: 'Usually performed laparoscopically (minimally invasive) or robotically. Open surgery is less common.' },
      { label: 'Eligibility', detail: 'Best suited for tumors that are smaller or positioned where partial removal is feasible.' },
    ],
    regimens: [
      { id: 'pnx-lap', name: 'Laparoscopic partial nephrectomy', category: 'Minimally invasive', description: 'Small incisions, camera-guided. Shorter hospital stay and faster recovery.' },
      { id: 'pnx-rob', name: 'Robotic-assisted partial nephrectomy', category: 'Minimally invasive', description: 'Robot-assisted precision. Similar recovery to laparoscopic approach.' },
      { id: 'pnx-open', name: 'Open partial nephrectomy', category: 'Open surgery', description: 'Single larger incision. May be used for complex tumor positions.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_RADICAL_NEPHRECTOMY': {
    type: 'procedure',
    title: 'Radical nephrectomy (surgery)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'Surgery to remove the entire kidney along with nearby tissue. Recommended when partial removal is not feasible.',
    goals: [
      'Remove the entire tumor and kidney with clear margins',
      'Prevent local recurrence',
      'Provide definitive surgical treatment',
    ],
    overview: [
      { label: 'Recovery time', detail: 'Hospital stay of 2–4 days. Full recovery typically 3–6 weeks.' },
      { label: 'Living with one kidney', detail: 'Most people live well with one kidney. Your care team will monitor kidney function after surgery.' },
      { label: 'Surgical approach', detail: 'Usually laparoscopic or robotic. Open surgery is used in some cases.' },
      { label: 'When it is recommended', detail: 'Used when the tumor is large, centrally located, or partial removal is not safely possible.' },
    ],
    regimens: [
      { id: 'rnx-lap', name: 'Laparoscopic radical nephrectomy', category: 'Minimally invasive', description: 'Most common approach. Small incisions, shorter recovery.' },
      { id: 'rnx-rob', name: 'Robotic-assisted radical nephrectomy', category: 'Minimally invasive', description: 'Robot-assisted. Similar outcomes to laparoscopic.' },
      { id: 'rnx-open', name: 'Open radical nephrectomy', category: 'Open surgery', description: 'Used for large or complex tumors.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_PERCUT_ABLATION': {
    type: 'procedure',
    title: 'Percutaneous ablation',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'A needle is guided through the skin to destroy the tumor using heat or cold — without removing the kidney.',
    goals: [
      'Destroy tumor cells without surgery',
      'Preserve kidney tissue and function',
      'Minimal recovery time compared to surgery',
    ],
    overview: [
      { label: 'How it works', detail: 'A radiologist inserts a needle directly into the tumor under imaging guidance. Heat (radiofrequency or microwave) or extreme cold (cryoablation) destroys the tumor.' },
      { label: 'Recovery', detail: 'Usually done as an outpatient procedure. Most people go home the same day or after one night.' },
      { label: 'Best suited for', detail: 'Small tumors (under 3–4 cm), patients who are not good surgical candidates, or those who want to preserve maximum kidney function.' },
      { label: 'Follow-up imaging', detail: 'CT or MRI scans are needed after treatment to confirm the tumor was fully treated.' },
    ],
    regimens: [
      { id: 'abl-rfa', name: 'Radiofrequency ablation (RFA)', category: 'Heat-based', description: 'Uses electrical energy to heat and destroy tumor cells.' },
      { id: 'abl-mwa', name: 'Microwave ablation (MWA)', category: 'Heat-based', description: 'Uses microwave energy. Can treat larger areas than RFA.' },
      { id: 'abl-cryo', name: 'Cryoablation', category: 'Cold-based', description: 'Uses extreme cold to freeze and destroy the tumor.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_RT_SBRT': {
    type: 'procedure',
    title: 'Radiation therapy (SBRT)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'High doses of precisely targeted radiation delivered to the tumor over a small number of treatment sessions.',
    goals: [
      'Destroy the tumor without surgery',
      'Preserve kidney function',
      'Option for patients who cannot undergo surgery',
    ],
    overview: [
      { label: 'Treatment sessions', detail: 'Typically 3–5 sessions over 1–2 weeks. Each session takes 30–60 minutes.' },
      { label: 'Precision targeting', detail: 'Advanced imaging is used to precisely aim radiation at the tumor while protecting surrounding healthy tissue.' },
      { label: 'Side effects', detail: 'Generally well tolerated. Fatigue is the most common side effect. Skin irritation can occur.' },
      { label: 'Follow-up', detail: 'Imaging scans after treatment monitor response. Kidney function is tracked over time.' },
    ],
    regimens: [
      { id: 'sbrt-standard', name: 'SBRT (stereotactic body radiation therapy)', category: 'Standard', description: 'Precisely focused radiation over 3–5 sessions.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_ACTIVE_SURVEILLANCE': {
    type: 'procedure',
    title: 'Active surveillance',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'Regular monitoring with imaging scans instead of immediate treatment. Used for small, slow-growing tumors where the risks of treatment may outweigh the benefits.',
    goals: [
      'Avoid unnecessary treatment for slow-growing tumors',
      'Monitor closely so treatment can start if the tumor grows',
      'Preserve quality of life',
    ],
    overview: [
      { label: 'Imaging schedule', detail: 'CT or MRI scans every 3–6 months initially, then annually if the tumor is stable.' },
      { label: 'Who it is for', detail: 'Small tumors (under 2–3 cm), older patients, those with other significant health conditions, or patients who prefer to avoid surgery.' },
      { label: 'Switching to treatment', detail: 'If the tumor grows significantly or symptoms develop, active treatment is recommended.' },
      { label: 'What to expect', detail: 'Regular clinic visits and imaging. Most people on active surveillance never need treatment for their small kidney tumor.' },
    ],
    regimens: [
      { id: 'surv-active', name: 'Active surveillance protocol', category: 'Monitoring', description: 'Regular imaging and clinic visits. No treatment unless growth is detected.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  // ── ADJUVANT / NEXT STEPS: STAGE I–III ───────────────────────────

  'RCC_RCTS_ADJUV_PEMBRO': {
    type: 'medication',
    title: 'Adjuvant Pembrolizumab (Keytruda)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'An immunotherapy given after surgery to reduce the risk of the cancer coming back. Based on the KEYNOTE-564 clinical trial.',
    goals: [
      'Reduce the risk of cancer recurrence after surgery',
      'Help the immune system recognise and destroy any remaining cancer cells',
      'Improve long-term disease-free survival',
    ],
    overview: [
      { label: 'Duration', detail: '17 cycles over approximately 12 months. Given every 6 weeks as an IV infusion.' },
      { label: 'Who it is for', detail: 'Patients with intermediate-high or high-risk Stage I–III clear cell RCC who have had surgery (KEYNOTE-564 criteria).' },
      { label: 'Side effects', detail: 'Immune-related side effects can affect any organ. Fatigue, skin rash, and joint pain are most common. Serious immune reactions are uncommon but require prompt attention.' },
      { label: 'Monitoring', detail: 'Regular blood tests and clinic visits throughout treatment. Imaging at scheduled intervals.' },
    ],
    regimens: [
      { id: 'pembro-adjuv', name: 'Pembrolizumab 400mg Q6W', category: 'NCCN Category 1', description: '400mg IV infusion every 6 weeks × 17 cycles (approximately 12 months).' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024. Based on KEYNOTE-564.',
  },

  'RCC_RCTS_CLINICAL_TRIAL': {
    type: 'procedure',
    title: 'Clinical trial',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'A clinical trial gives access to newer treatments being studied that are not yet widely available. NCCN recommends considering a clinical trial at any point in treatment.',
    goals: [
      'Access to novel therapies not yet approved',
      'Contribute to advancing cancer treatment',
      'Close monitoring throughout participation',
    ],
    overview: [
      { label: 'What to expect', detail: 'Trials vary widely. Your care team will explain the specific protocol, schedule, and what is known about the treatment being studied.' },
      { label: 'Eligibility', detail: 'Each trial has specific eligibility criteria. Your oncologist can identify trials you may qualify for.' },
      { label: 'Finding trials', detail: 'ClinicalTrials.gov lists all active trials. Your cancer centre may also have relevant trials available.' },
      { label: 'Your rights', detail: 'Participation is always voluntary. You can withdraw at any time without affecting your other care.' },
    ],
    regimens: [
      { id: 'ct-general', name: 'Clinical trial (discuss with your care team)', category: 'Research', description: 'Your oncologist can identify trials you may qualify for.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_SURVEILLANCE': {
    type: 'procedure',
    title: 'Surveillance after treatment',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'Regular visits and imaging after treatment to monitor for recurrence and track kidney function.',
    goals: [
      'Detect any cancer recurrence early',
      'Monitor kidney function over time',
      'Catch and address treatment side effects',
    ],
    overview: [
      { label: 'Imaging schedule', detail: 'CT of chest, abdomen, and pelvis every 3–6 months for the first 2–3 years, then annually.' },
      { label: 'Blood tests', detail: 'Kidney function, blood count, and metabolic panel at each visit.' },
      { label: 'What to report', detail: 'New symptoms, unexplained pain, fatigue, or changes in urination should be reported promptly.' },
      { label: 'Duration', detail: 'Surveillance continues for at least 5 years after treatment, and sometimes longer.' },
    ],
    regimens: [
      { id: 'surv-post', name: 'Post-treatment surveillance protocol', category: 'Monitoring', description: 'Regular imaging and labs per NCCN schedule.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  // ── STAGE IV ─────────────────────────────────────────────────────

  'RCC_RCTS_METASTASECTOMY_ADJUV_PEMBRO': {
    type: 'procedure',
    title: 'Metastasectomy + adjuvant Pembrolizumab',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'When all visible areas of cancer spread can be completely removed, surgery followed by adjuvant pembrolizumab may improve outcomes.',
    goals: [
      'Remove all visible metastatic disease surgically',
      'Use immunotherapy after surgery to reduce recurrence risk',
    ],
    overview: [
      { label: 'Two-part treatment', detail: 'First, surgery to remove all sites of spread. Then pembrolizumab immunotherapy after recovery.' },
      { label: 'Eligibility', detail: 'Only suitable when all metastatic sites are technically resectable and the patient is fit for surgery.' },
      { label: 'Pembrolizumab duration', detail: 'Following surgery, pembrolizumab is given every 6 weeks for approximately 12 months.' },
    ],
    regimens: [
      { id: 'meta-pembro', name: 'Metastasectomy + Pembrolizumab 400mg Q6W', category: 'Surgery + Immunotherapy', description: 'Surgery for complete resection followed by pembrolizumab for 17 cycles.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_SYSTEMIC_FIRSTLINE_CLEARCELL': {
    type: 'medication',
    title: 'First-line systemic therapy (clear cell)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'Several medicine combinations are available as the first treatment for metastatic clear cell kidney cancer. The best choice depends on your health, risk category, and preferences.',
    goals: [
      'Control cancer growth and spread',
      'Shrink existing tumors where possible',
      'Improve overall and progression-free survival',
    ],
    overview: [
      { label: 'Combination approach', detail: 'Most regimens combine an immunotherapy (PD-1/PD-L1 inhibitor) with either another immunotherapy or a targeted therapy (VEGF inhibitor).' },
      { label: 'Risk category', detail: 'Your oncologist will assess your IMDC risk score to help select the most appropriate regimen.' },
      { label: 'Duration', detail: 'Treatment continues until the cancer progresses or side effects become unmanageable. Some regimens have defined endpoints.' },
    ],
    regimens: [
      { id: 'fl-nivo-cabo', name: 'Nivolumab + Cabozantinib', category: 'NCCN Category 1', description: 'Nivolumab 240mg IV Q2W or 480mg Q4W + cabozantinib 40mg oral daily. Combination immunotherapy + targeted therapy.' },
      { id: 'fl-pembro-axitinib', name: 'Pembrolizumab + Axitinib', category: 'NCCN Category 1', description: 'Pembrolizumab 200mg IV Q3W + axitinib 5mg oral twice daily.' },
      { id: 'fl-nivo-ipi', name: 'Nivolumab + Ipilimumab', category: 'NCCN Category 1 (intermediate/poor risk)', description: 'Dual immunotherapy. Nivolumab 3mg/kg + ipilimumab 1mg/kg Q3W × 4, then nivolumab maintenance.' },
      { id: 'fl-pembro-lenvat', name: 'Pembrolizumab + Lenvatinib', category: 'NCCN Category 1', description: 'Pembrolizumab 200mg IV Q3W + lenvatinib 20mg oral daily.' },
      { id: 'fl-cabo-mono', name: 'Cabozantinib (monotherapy)', category: 'NCCN Category 1 (poor risk)', description: 'Oral targeted therapy 60mg daily. Option for poor-risk patients or those not suited to immunotherapy.' },
      { id: 'fl-sunitinib', name: 'Sunitinib', category: 'NCCN Category 1', description: '50mg oral daily, 4 weeks on / 2 weeks off.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_NEPHRECTOMY': {
    type: 'procedure',
    title: 'Nephrectomy (surgery)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'Surgery to remove the kidney and surrounding tissue when the tumor can be surgically removed.',
    goals: [
      'Remove the primary tumor',
      'Provide local disease control',
      'Prepare for systemic therapy if needed',
    ],
    overview: [
      { label: 'In Stage IV', detail: 'Surgery in metastatic disease is used selectively — when the kidney tumor is causing symptoms, or in combination with systemic therapy.' },
      { label: 'Recovery', detail: '2–4 days in hospital. Full recovery 3–6 weeks depending on approach.' },
    ],
    regimens: [
      { id: 'nep-lap', name: 'Laparoscopic nephrectomy', category: 'Minimally invasive', description: 'Small incisions, camera-guided removal.' },
      { id: 'nep-open', name: 'Open nephrectomy', category: 'Open surgery', description: 'Used for larger or more complex tumors.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_CYTOREDUCTIVE_NEPHRECTOMY': {
    type: 'procedure',
    title: 'Cytoreductive nephrectomy',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'Surgery to remove the kidney even when the cancer has spread, to reduce the overall tumor burden and potentially improve response to systemic therapy.',
    goals: [
      'Reduce the total amount of cancer in the body',
      'Potentially improve response to subsequent systemic therapy',
      'Manage symptoms caused by the primary tumor',
    ],
    overview: [
      { label: 'Who it is for', detail: 'Selected patients with good performance status, limited metastatic burden, and a primary tumor causing symptoms or making up the bulk of disease.' },
      { label: 'Timing', detail: 'May be done before systemic therapy (upfront) or after a period of treatment (deferred) to confirm disease does not rapidly progress.' },
      { label: 'Recovery', detail: 'Similar to standard nephrectomy. Systemic therapy typically starts 4–6 weeks after surgery.' },
    ],
    regimens: [
      { id: 'cyto-nep', name: 'Cytoreductive nephrectomy', category: 'Surgery', description: 'Removal of the primary kidney tumor in the setting of metastatic disease.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_METASTASECTOMY_SBRT': {
    type: 'procedure',
    title: 'Metastasectomy or SBRT or ablation',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'When the cancer has spread to only a few places, surgery, focused radiation, or ablation can treat those specific sites.',
    goals: [
      'Remove or destroy limited sites of spread',
      'Achieve local control of metastatic lesions',
      'Potentially delay the need for systemic therapy',
    ],
    overview: [
      { label: 'Oligometastatic disease', detail: 'This approach is used when there are only 1–3 metastatic sites that can be completely treated.' },
      { label: 'Options', detail: 'Surgery (metastasectomy), focused radiation (SBRT), or image-guided ablation — chosen based on site location and patient health.' },
    ],
    regimens: [
      { id: 'oligo-surgery', name: 'Metastasectomy', category: 'Surgery', description: 'Surgical removal of metastatic lesion(s).' },
      { id: 'oligo-sbrt', name: 'SBRT to metastatic sites', category: 'Radiation', description: 'Focused radiation to 1–3 metastatic lesions over 3–5 sessions.' },
      { id: 'oligo-ablation', name: 'Percutaneous ablation of metastases', category: 'Ablation', description: 'Needle-based ablation for accessible metastatic sites.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_BEST_SUPPORTIVE_CARE': {
    type: 'procedure',
    title: 'Best supportive care',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'Care focused on relieving symptoms, improving comfort, and maintaining quality of life — rather than treating the cancer directly.',
    goals: [
      'Manage pain and other symptoms effectively',
      'Protect and strengthen bones if affected',
      'Support overall wellbeing and quality of life',
    ],
    overview: [
      { label: 'Palliative intent', detail: 'Supportive care focuses on how you feel day to day, not on shrinking the tumor. It can be given alongside or instead of cancer-directed treatment.' },
      { label: 'Bone health', detail: 'If the cancer has spread to bones, medications to protect bone strength may be recommended.' },
      { label: 'Pain management', detail: 'A dedicated pain and palliative care team can help manage pain, fatigue, and other symptoms.' },
      { label: 'Your preferences', detail: 'Supportive care planning is centred around your goals, values, and what matters most to you.' },
    ],
    regimens: [
      { id: 'bsc-general', name: 'Best supportive care', category: 'Palliative', description: 'Symptom management, pain control, bone protection, and quality of life support.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_SYSTEMIC_NONCLEARCELL': {
    type: 'medication',
    title: 'Systemic therapy (non-clear cell)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'For kidney cancers that are not the most common clear cell type, several medicine options are available based on the specific subtype.',
    goals: [
      'Control cancer growth in non-clear cell subtypes',
      'Tailor treatment to the specific histology',
    ],
    overview: [
      { label: 'Subtypes', detail: 'Non-clear cell RCC includes papillary, chromophobe, translocation, medullary, and other rare subtypes. Each may respond differently to treatment.' },
      { label: 'Clinical trial', detail: 'NCCN strongly recommends considering a clinical trial for non-clear cell RCC, as evidence is more limited than for clear cell disease.' },
    ],
    regimens: [
      { id: 'ncc-cabo', name: 'Cabozantinib', category: 'NCCN Category 2A', description: 'Oral targeted therapy. Broadest evidence across non-clear cell subtypes.' },
      { id: 'ncc-suni', name: 'Sunitinib', category: 'NCCN Category 2A', description: 'Oral VEGF inhibitor. Historical standard for papillary RCC.' },
      { id: 'ncc-ever', name: 'Everolimus', category: 'NCCN Category 2A', description: 'Oral mTOR inhibitor.' },
      { id: 'ncc-ct', name: 'Clinical trial', category: 'Preferred', description: 'Preferred option per NCCN given limited evidence in non-clear cell subtypes.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_SYSTEMIC_SUBSEQUENT_CLEARCELL_PRIORIO': {
    type: 'medication',
    title: 'Subsequent systemic therapy (clear cell, prior IO)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'When the cancer grows after a first treatment that included immunotherapy, several targeted therapies are available as the next line of treatment.',
    goals: [
      'Control cancer growth after prior immunotherapy',
      'Extend progression-free survival',
      'Maintain quality of life',
    ],
    overview: [
      { label: 'Targeted therapy focus', detail: 'After IO-based first-line therapy, VEGF-targeted agents are the primary subsequent option.' },
      { label: 'Treatment selection', detail: 'Choice depends on prior therapies, performance status, and side effect profile preferences.' },
      { label: 'Duration', detail: 'Treatment continues until progression or unacceptable toxicity.' },
    ],
    regimens: [
      { id: 'sub-io-cabo', name: 'Cabozantinib', category: 'NCCN Category 1', description: 'Oral VEGF/MET/AXL inhibitor. 60mg daily. Preferred option after IO-based first-line therapy.' },
      { id: 'sub-io-lenvat-ever', name: 'Lenvatinib + Everolimus', category: 'NCCN Category 1', description: 'Lenvatinib 18mg + everolimus 5mg oral daily. Combination targeted therapy.' },
      { id: 'sub-io-axitinib', name: 'Axitinib', category: 'NCCN Category 2A', description: 'Oral VEGF inhibitor. 5mg twice daily.' },
      { id: 'sub-io-suni', name: 'Sunitinib', category: 'NCCN Category 2A', description: 'Oral VEGF inhibitor. 50mg daily 4 weeks on / 2 off.' },
      { id: 'sub-io-nivo', name: 'Nivolumab (monotherapy)', category: 'NCCN Category 2A', description: 'May be considered if not previously used as monotherapy.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },

  'RCC_RCTS_SYSTEMIC_SUBSEQUENT_CLEARCELL_IONAIVE': {
    type: 'medication',
    title: 'Subsequent systemic therapy (clear cell, IO naïve)',
    clinicalClass: 'Suggested treatment · NCCN Guidelines',
    description: 'When the cancer grows after a first treatment that did not include immunotherapy, both immunotherapy and targeted therapy options are available.',
    goals: [
      'Control cancer growth after prior targeted therapy',
      'Introduce immunotherapy if not previously used',
      'Extend progression-free survival',
    ],
    overview: [
      { label: 'Immunotherapy opportunity', detail: 'If first-line therapy did not include immunotherapy, nivolumab monotherapy is a preferred subsequent option.' },
      { label: 'Targeted therapy', detail: 'VEGF inhibitors remain active after progression on first-line VEGF therapy in many patients.' },
      { label: 'Duration', detail: 'Treatment continues until progression or unacceptable toxicity.' },
    ],
    regimens: [
      { id: 'sub-nv-nivo', name: 'Nivolumab (monotherapy)', category: 'NCCN Category 1', description: 'PD-1 immunotherapy. 240mg IV Q2W or 480mg Q4W. Preferred if no prior IO.' },
      { id: 'sub-nv-cabo', name: 'Cabozantinib', category: 'NCCN Category 1', description: 'Oral targeted therapy. 60mg daily.' },
      { id: 'sub-nv-lenvat-ever', name: 'Lenvatinib + Everolimus', category: 'NCCN Category 1', description: 'Oral combination targeted therapy.' },
      { id: 'sub-nv-axitinib', name: 'Axitinib', category: 'NCCN Category 2A', description: 'Oral VEGF inhibitor. 5mg twice daily.' },
      { id: 'sub-nv-ever', name: 'Everolimus', category: 'NCCN Category 2A', description: 'Oral mTOR inhibitor. 10mg daily.' },
      { id: 'sub-nv-suni', name: 'Sunitinib', category: 'NCCN Category 2A', description: 'If not used first-line.' },
    ],
    source: 'NCCN Clinical Practice Guidelines in Oncology: Kidney Cancer, Version 2.2024.',
  },
}
