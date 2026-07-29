import { RECOMMENDATION_RULES } from '../data/recommendationRules.js'

// ─── RECOMMENDATION ENGINE ────────────────────────────────────────
// Pure function — same inputs always produce same outputs.
// Returns recommendation objects grouped into SuggestedBlocks.
export const deriveRecommendations = (patientState, planItems) => {
  const active = RECOMMENDATION_RULES.filter(rule => {
    try { return rule.condition(patientState, planItems) }
    catch { return false }
  })

  const groups = {}
  for (const rule of active) {
    if (!groups[rule.group]) {
      groups[rule.group] = {
        id: `group_${rule.group}`,
        group: rule.group,
        stepLabel: rule.groupLabel,
        stepBody: rule.groupBody,
        options: [],
        clarifyingQuestion: rule.clarifyingQuestion || null,
      }
    }
    groups[rule.group].options.push({
      id: rule.id,
      title: rule.title,
      description: rule.description,
      subtitle: rule.subtitle,
      phase: rule.phase,
      type: rule.type,
    })
  }

  return Object.values(groups)
}

// ─── ADDED IDS ────────────────────────────────────────────────────
// Derives a map of { ruleId: { count, dateAdded, items } } from plan items.
// Used to show "Added · date" indicators on recommendation options.
export const getAddedIds = (allPlanItems) => {
  const addedIds = {}
  for (const rule of RECOMMENDATION_RULES) {
    // An item counts as "added" for this rule if the rule's predicate matches it,
    // OR it was explicitly created from this recommendation (the add-to-plan flow
    // stamps createdFromRecommendationId). The latter guarantees the "Added" label
    // links even when the produced event doesn't satisfy the name/type predicate.
    const matched = allPlanItems.filter(e => (rule.matches && rule.matches(e)) || e.createdFromRecommendationId === rule.id)
    if (matched.length > 0) {
      const latest = matched[matched.length - 1]
      const d = latest?.date || latest?.startDate
      addedIds[rule.id] = {
        count: matched.length,
        dateAdded: d
          ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'recently',
        items: matched,
      }
    }
  }
  return addedIds
}

// ─── IMPACT DETECTION ────────────────────────────────────────────
// Returns true if adding `item` to planItems would change the visible
// recommendation groups (groups added, removed, or swapped).
export const wouldImpactRecommendations = (item, planItems, patientState) => {
  if (!patientState || !item) return false
  try {
    const before = deriveRecommendations(patientState, planItems).map(g => g.group).sort().join(',')
    const after  = deriveRecommendations(patientState, [...planItems, item]).map(g => g.group).sort().join(',')
    return before !== after
  } catch { return false }
}

// Returns context about what changes: which groups appear, which disappear,
// and the label of the first newly appearing group (for transition copy).
export const getImpactContext = (item, planItems, patientState) => {
  if (!patientState || !item) return null
  try {
    const before = deriveRecommendations(patientState, planItems)
    const after  = deriveRecommendations(patientState, [...planItems, item])
    const beforeIds = new Set(before.map(g => g.group))
    const afterIds  = new Set(after.map(g => g.group))
    const appearing  = after.filter(g => !beforeIds.has(g.group))
    const disappearing = before.filter(g => !afterIds.has(g.group))
    return {
      appearing,
      disappearing,
      newGroupLabel: appearing[0]?.stepLabel || null,
      removedGroupLabel: disappearing[0]?.stepLabel || null,
    }
  } catch { return null }
}

// ─── RULE LOOKUPS ─────────────────────────────────────────────────

// Find the rule whose matches() function matches this event AND is currently
// visible in the recommendations. Used by EventCard to show "restores as suggestion" hint.
export const findCoveringRule = (event, visibleRecs) => {
  if (!visibleRecs || visibleRecs.length === 0) return null
  return RECOMMENDATION_RULES.find(
    r => r.matches && r.matches(event) &&
    visibleRecs.some(g => g.options.some(o => o.id === r.id))
  ) || null
}

// Find the rule whose matches() fires on an item with the given name.
// Used by TreatmentDetailView to check if a regimen is on the plan.
export const findRuleMatchingItem = (itemName) => {
  return RECOMMENDATION_RULES.find(
    r => r.matches && r.matches({ name: itemName })
  ) || null
}

// Find all rules whose title overlaps with an event name (both directions).
// Used by handleComplete to record user decisions after adding an event.
export const findMatchingRules = (eventName) => {
  if (!eventName) return []
  const lower = eventName.toLowerCase()
  return RECOMMENDATION_RULES.filter(r =>
    r.title.toLowerCase().includes(lower) ||
    lower.includes(r.title.toLowerCase())
  )
}
