import { deriveRecommendations, getAddedIds } from '../services/recommendationService.js'

// ─── useRecommendations ───────────────────────────────────────────
// Derives all recommendation-related values from patientState and timeline.
// Pure derivation — no side effects, no state, no async.
//
// Returns:
//   allPlanItems  — flat array of all events across the timeline
//   visibleRecs   — SuggestedBlock[] from the recommendation engine
//   addedIds      — { [ruleId]: { count, dateAdded, items } }

export const useRecommendations = (patientState, timeline) => {
  // Flatten all timeline events as plan items for the engine
  const allPlanItems = timeline.flatMap(day => day.events || [])

  // Run the recommendation engine — pure function, same inputs → same outputs
  const visibleRecs = deriveRecommendations(patientState, allPlanItems)

  // Derive which rules have matching items on the plan
  const addedIds = getAddedIds(allPlanItems)

  return { allPlanItems, visibleRecs, addedIds }
}
