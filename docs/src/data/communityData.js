// ─── COMMUNITY SEED DATA ─────────────────────────────────────────
// Structured to match the three-level hierarchy:
//   COMMUNITIES[]  →  COMMUNITY_POSTS{}  →  POST_COMMENTS{}

export const COMMUNITIES = [
  {
    category: 'Kidney Cancer Communities',
    items: [
      {
        id: 'rcc-general',
        name: 'Kidney Cancer (RCC)',
        description: 'Connect with others navigating renal cell carcinoma — from diagnosis through treatment and beyond.',
        memberCount: 28430,
        color: '#e07b5a',
        initials: 'KC',
      },
      {
        id: 'rcc-clear-cell',
        name: 'Clear Cell RCC',
        description: 'Share experiences with clear cell histology, NCCN guidelines, and treatment decisions.',
        memberCount: 14820,
        color: '#5a8fd1',
        initials: 'CC',
      },
      {
        id: 'rcc-stage-iv',
        name: 'Metastatic Kidney Cancer',
        description: 'A community for those living with stage IV RCC — systemic therapy, trials, and daily life.',
        memberCount: 9340,
        color: '#7c6fb0',
        initials: 'MK',
      },
      {
        id: 'rcc-survivors',
        name: 'Kidney Cancer Survivors',
        description: 'Life after treatment — surveillance, late effects, and moving forward.',
        memberCount: 21650,
        color: '#4aab6d',
        initials: 'KS',
      },
    ],
  },
  {
    category: 'Treatment-Specific Communities',
    items: [
      {
        id: 'immunotherapy',
        name: 'Immunotherapy Patients',
        description: 'Navigating PD-1/PD-L1 inhibitors, immune-related side effects, and what to expect.',
        memberCount: 43200,
        color: '#d15a8a',
        initials: 'IO',
      },
      {
        id: 'clinical-trials',
        name: 'Clinical Trial Participants',
        description: 'Share experiences with trial protocols, eligibility, and participation.',
        memberCount: 18760,
        color: '#e0a84a',
        initials: 'CT',
      },
      {
        id: 'targeted-therapy',
        name: 'Targeted Therapy (VEGF/mTOR)',
        description: 'Cabozantinib, sunitinib, everolimus — managing oral targeted therapies at home.',
        memberCount: 22110,
        color: '#5ab8d1',
        initials: 'TT',
      },
    ],
  },
  {
    category: 'Support & Wellbeing',
    items: [
      {
        id: 'newly-diagnosed',
        name: 'Newly Diagnosed',
        description: "Just received a diagnosis? You're not alone. A space for questions, fear, and first steps.",
        memberCount: 61480,
        color: '#c25a5a',
        initials: 'ND',
      },
      {
        id: 'caregivers',
        name: 'Caregivers & Family',
        description: 'For those supporting a loved one — navigating care, emotions, and practical challenges.',
        memberCount: 34920,
        color: '#7ab85a',
        initials: 'CF',
      },
    ],
  },
]

// ── POSTS keyed by communityId ────────────────────────────────────
export const COMMUNITY_POSTS = {
  'rcc-general': [
    {
      id: 'post-rcc-1',
      communityId: 'rcc-general',
      author: { name: 'James T.', initials: 'JT', color: '#5a8fd1' },
      timeAgo: '2 days ago',
      body: "Just finished my 12-month surveillance CT — clear scan! My oncologist said we'll move to annual scans now. For anyone early in the process, the surveillance period is hard but it does get easier. Hang in there.",
      likes: 47,
      commentCount: 12,
    },
    {
      id: 'post-rcc-2',
      communityId: 'rcc-general',
      author: { name: 'Maria S.', initials: 'MS', color: '#d15a8a' },
      timeAgo: '5 days ago',
      body: "Question for the group — has anyone had experience with the KEYNOTE-564 criteria for adjuvant pembrolizumab? My oncologist is recommending it but I'm trying to understand if I qualify as intermediate-high risk. My pT2 grade 4 tumour was completely resected.",
      likes: 23,
      commentCount: 8,
    },
    {
      id: 'post-rcc-3',
      communityId: 'rcc-general',
      author: { name: 'David K.', initials: 'DK', color: '#4aab6d' },
      timeAgo: '1 week ago',
      body: "Six months post partial nephrectomy and my eGFR has stabilised at 64. The first few months were scary watching it drop, but the remaining kidney has compensated more than expected. If you're worried about kidney function after surgery — keep up with the labs and give it time.",
      likes: 61,
      commentCount: 15,
    },
    {
      id: 'post-rcc-4',
      communityId: 'rcc-general',
      author: { name: 'Priya N.', initials: 'PN', color: '#e07b5a' },
      timeAgo: '2 weeks ago',
      body: "Does anyone have tips for managing fatigue during adjuvant pembrolizumab? I'm on cycle 4 and the tiredness is manageable but I want to stay ahead of it rather than let it build up.",
      likes: 34,
      commentCount: 19,
    },
  ],
  'rcc-clear-cell': [
    {
      id: 'post-cc-1',
      communityId: 'rcc-clear-cell',
      author: { name: 'Rachel B.', initials: 'RB', color: '#7c6fb0' },
      timeAgo: '3 days ago',
      body: "Pathology came back clear cell, grade 2, pT1b. My surgeon is recommending partial nephrectomy. Has anyone had experience with the robotic approach versus laparoscopic? Trying to understand the difference in recovery.",
      likes: 18,
      commentCount: 9,
    },
    {
      id: 'post-cc-2',
      communityId: 'rcc-clear-cell',
      author: { name: 'Tom H.', initials: 'TH', color: '#5ab8d1' },
      timeAgo: '1 week ago',
      body: "For those of you who had clear cell RCC stage I — did your oncologist recommend adjuvant therapy or surveillance? I'm getting conflicting guidance and trying to understand what the NCCN guidelines actually say for low-risk patients.",
      likes: 41,
      commentCount: 22,
    },
  ],
  'immunotherapy': [
    {
      id: 'post-io-1',
      communityId: 'immunotherapy',
      author: { name: 'Sandra L.', initials: 'SL', color: '#e0a84a' },
      timeAgo: '1 day ago',
      body: "Cycle 6 of pembrolizumab done. Developed some thyroid issues (hypothyroidism) which my team says is actually a positive immune response sign. Now on levothyroxine. Anyone else dealing with thyroid side effects? It's manageable but wasn't expecting it.",
      likes: 29,
      commentCount: 14,
    },
    {
      id: 'post-io-2',
      communityId: 'immunotherapy',
      author: { name: 'Kevin M.', initials: 'KM', color: '#c25a5a' },
      timeAgo: '4 days ago',
      body: "Important reminder to the group — report any new symptoms to your oncology team promptly, even if they seem minor. I had what I thought was a mild rash and it turned out to be immune-related dermatitis. Caught early it was easy to manage.",
      likes: 87,
      commentCount: 6,
    },
  ],
}

// ── COMMENTS keyed by postId ──────────────────────────────────────
export const POST_COMMENTS = {
  'post-rcc-1': [
    {
      id: 'c1',
      author: { name: 'Linda W.', initials: 'LW', color: '#7c6fb0' },
      timeAgo: '2 days ago',
      body: "Congratulations! This is such great news. I'm 8 months out and this gives me so much hope.",
    },
    {
      id: 'c-ai-rcc-1',
      isAI: true,
      timeAgo: '2 days ago',
      body: "Annual surveillance after a clear 12-month scan is consistent with NCCN guidelines for low and intermediate-risk RCC. The transition from more frequent to annual imaging is a meaningful milestone. For anyone in early surveillance, symptoms to watch for between scans include unexplained pain, fatigue, or blood in urine — report these to your care team promptly rather than waiting for a scheduled scan.",
    },
    {
      id: 'c3',
      author: { name: 'Michael R.', initials: 'MR', color: '#e07b5a' },
      timeAgo: '1 day ago',
      body: "Just hit my 6-month clear scan last week. Seeing your post makes me feel like I can get to 12 months too. Thank you for sharing.",
    },
  ],
  'post-rcc-2': [
    {
      id: 'c-ai-rcc-2',
      isAI: true,
      timeAgo: '5 days ago',
      body: "The KEYNOTE-564 trial enrolled patients with clear cell RCC who had complete resection and were at intermediate-high, high, or M1 NED risk. Intermediate-high risk is generally defined as pT2 grade 4 or pT3 any grade. A pT2 grade 4 tumour with negative margins would typically fall in this category. Your oncologist is the right person to confirm eligibility based on your full pathology report. It's worth asking specifically about your IMDC risk score and how it factors into the recommendation.",
    },
    {
      id: 'c5',
      author: { name: 'James T.', initials: 'JT', color: '#5a8fd1' },
      timeAgo: '4 days ago',
      body: "I'm on KEYNOTE-564 adjuvant pembro. My surgeon called me pT2 grade 4 as well. It is a commitment — 17 cycles over a year — but the side effects have been manageable for me. Feel free to message me if you want to talk through it.",
    },
  ],
  'post-rcc-4': [
    {
      id: 'c-ai-rcc-4',
      isAI: true,
      timeAgo: '2 weeks ago',
      body: "Fatigue during immunotherapy is common and often cumulative. Evidence-based strategies that help many patients include: prioritising sleep consistency over total hours, light aerobic activity (even a 20-minute walk) on days when energy allows, and tracking fatigue patterns relative to your infusion cycle so you can plan lower-demand activities in your peak-fatigue window. If fatigue is significantly impacting daily function, tell your oncology team — dose adjustments or a short break are options.",
    },
    {
      id: 'c8',
      author: { name: 'Sandra L.', initials: 'SL', color: '#e0a84a' },
      timeAgo: '2 weeks ago',
      body: "The fatigue for me peaks around days 3–5 post infusion then improves. I block those days out and plan lighter activities. The predictability actually helps more than anything.",
    },
  ],
  'post-io-1': [
    {
      id: 'c-ai-io-1',
      isAI: true,
      timeAgo: '1 day ago',
      body: "Immune-related thyroid dysfunction (most commonly hypothyroidism) occurs in roughly 10–15% of patients on PD-1 inhibitors. In many oncology teams it's considered a marker of immune activation, though this doesn't mean it should go unmanaged. Levothyroxine replacement is straightforward and most patients tolerate it well. Thyroid labs are typically checked every 2–3 cycles — make sure your team is monitoring TSH and free T4 regularly. Symptoms to report: unusual fatigue beyond your baseline, cold intolerance, weight changes, or heart palpitations.",
    },
  ],
}
