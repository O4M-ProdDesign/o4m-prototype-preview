import { PROCEDURE_CATALOG, PROC_SUGGESTED } from '../data/procedureCatalog.js'
import { SCAN_CATALOG, SCAN_SUGGESTED } from '../data/scanCatalog.js'
import { MEDICATION_CATALOG, MED_SUGGESTED } from '../data/medicationCatalog.js'

// ─── CATALOG ACCESSORS ────────────────────────────────────────────
// Components import from here rather than from data/ directly.
// Keeps all catalog ownership in one place for future API migration.

export const getProcedureCatalog = () => PROCEDURE_CATALOG
export const getProcedureSuggested = () => PROC_SUGGESTED

export const getScanCatalog = () => SCAN_CATALOG
export const getScanSuggested = () => SCAN_SUGGESTED

export const getMedicationCatalog = () => MEDICATION_CATALOG
export const getMedicationSuggested = () => MED_SUGGESTED

// ─── CATALOG SEARCH ───────────────────────────────────────────────
// Synchronous search across a catalog array.
// Called by CatalogSearchStep with the appropriate catalog.
export const searchCatalog = (catalog, query) => {
  if (!query || !query.trim()) return []
  const lower = query.toLowerCase().trim()
  return catalog.filter(
    item =>
      item.name.toLowerCase().includes(lower) ||
      item.searchTerms.some(term => term.includes(lower))
  )
}
