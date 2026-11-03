// ─── Patient copy ──────────────────────────────────────────────────
// One string per sentence; the app fills in WHO at render time.
//
// The rule — ask of every sentence: "who is this about?"
//   • About the person with cancer (their body, feelings, symptoms, diagnosis, treatment,
//     appointments, record) → write it with patient tokens. Self reads "you"; a caregiver
//     reads the name they gave ("Mom").
//   • About the person holding the phone (taking an action, settings, their account,
//     things they manage like "your care plan" / "your care team") → plain "you".
//
// Relationship is a CONTENT signal (picks caregiver-relevant articles/community), never copy.
export const RELATIONSHIPS = [
  { value: 'parent',  label: 'Parent' },
  { value: 'spouse',  label: 'Spouse or partner' },
  { value: 'child',   label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend',  label: 'Friend' },
  { value: 'other',   label: 'Other' },
]

// Tokens (capitalize the token to capitalize the output):
//   {they}    you        | Mom          {They}    You        | Mom
//   {their}   your       | Mom's        {Their}   Your       | Mom's
//   {they're} you're     | Mom is       {They're} You're     | Mom is
//   {they've} you've     | Mom has      {They've} You've     | Mom has
//   {self|caregiver}  any word that changes with the subject: {are|is} {were|was} {have|has}
//
// Writing rules (so it never reads oddly):
//   1. Name the person at most once per sentence; later references use "the"
//      ("{Their} diagnosis is on the care plan", not "…on {their} care plan").
//   2. No he/she/they pronouns — we don't know them. Build the sentence so it doesn't need one.
//   3. Shared things stay "your": your care plan, your care team, your next steps.
//
// Example:  How {are|is} {they} feeling today?
//   self      → How are you feeling today?
//   caregiver → How is Mom feeling today?

export const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
export const possessive = (t) => `${t}'s`   // Chicago style: Chris's

// Normalize what a caregiver typed: "mom" → "Mom"; "my husband" → "your husband" (the app
// is speaking to the caregiver).
export const careName = (raw) => {
  const t = (raw || '').trim().replace(/\s+/g, ' ')
  if (!t) return ''
  if (/^my\s+/i.test(t)) return t.replace(/^my\s+/i, 'your ')
  return cap(t)
}

// Who the record is about, derived from the patient state.
// Safety net only: a caregiver must give a name. If it's ever missing, use the relationship
// they picked ("your parent"); for "Other" or no relationship, use the "you" wording.
const RELATIONSHIP_REF = { parent: 'your parent', spouse: 'your partner', child: 'your child', sibling: 'your sibling', friend: 'your friend' }
const SELF_SUBJECT = { self: true, name: null, relationship: null, ref: 'you', Ref: 'You', poss: 'your', Poss: 'Your' }
export const careSubject = (ps) => {
  if (!ps || ps.role !== 'caregiver') return SELF_SUBJECT
  const ref = careName(ps.patientName) || RELATIONSHIP_REF[ps.relationship]
  if (!ref) return SELF_SUBJECT
  return { self: false, name: ref, relationship: ps.relationship || null, ref, Ref: cap(ref), poss: possessive(ref), Poss: cap(possessive(ref)) }
}

const SELF = { "they": 'you', "their": 'your', "they're": "you're", "they've": "you've" }

// Fill a template for a subject. Unknown single-word tokens are left as-is, so a stray
// brace in copy never breaks a screen (own keys only: "{constructor}" stays as written).
// Tokens may nest — innermost resolve first: "Any symptoms {|for {they} }today?"
//   self → "Any symptoms today?"   caregiver → "Any symptoms for Mom today?"
// A name the caregiver typed is never read as copy: while tokens resolve, the name stands in
// as a private placeholder and is swapped in only at the end, so "Mom {their}" or "Mom|Dad"
// come through unchanged and can't loop.
const NAME_REF = '\uE000', NAME_POSS = '\uE001'
export const fillCopy = (template, sub) => {
  if (!template || typeof template !== 'string' || template.indexOf('{') < 0) return template
  const s = sub || careSubject(null)
  let out = template, prev
  do { prev = out; out = fillOnce(prev, s) } while (out !== prev)
  if (!s.self) out = out.split(NAME_POSS_CAP).join(s.Poss).split(NAME_REF_CAP).join(s.Ref).split(NAME_POSS).join(s.poss).split(NAME_REF).join(s.ref)
  return out
}
const fillOnce = (template, s) => {
  return template.replace(/\{([^{}]*)\}/g, (whole, inner) => {
    if (inner.includes('|')) {
      const [selfForm, cgForm = selfForm] = inner.split('|')
      return s.self ? selfForm : cgForm
    }
    const key = inner.toLowerCase()
    if (!Object.prototype.hasOwnProperty.call(SELF, key)) return whole
    const upper = inner.charAt(0) === inner.charAt(0).toUpperCase()
    if (s.self) return upper ? cap(SELF[key]) : SELF[key]
    // Caregiver: placeholders, capitalized where the token is (cap only touches the first
    // character, so capitalize the name's first letter by marking it below).
    const ref = upper ? NAME_REF_CAP : NAME_REF
    const poss = upper ? NAME_POSS_CAP : NAME_POSS
    if (key === 'they') return ref
    if (key === 'their') return poss
    if (key === "they're") return `${ref} is`
    return `${ref} has`   // they've
  })
}
const NAME_REF_CAP = '\uE002', NAME_POSS_CAP = '\uE003'
