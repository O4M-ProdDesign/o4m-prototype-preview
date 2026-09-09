# O4M Prototype — Handoff Document

This document is for the next Claude conversation picking up this prototype. Read it fully before making any changes.

---

## What this is

A React prototype for the Outcomes4Me (O4M) care plan / health timeline experience. It runs in the browser as a single self-contained HTML file hosted on GitHub Pages. The prototype is built in Vite and compiled to a single inline `docs/index.html` for deployment.

The prototype covers the mobile care plan tab — a vertical timeline of health events, a daily summary, a recommendations engine, onboarding, and various add/edit/delete flows.

---

## File structure (what's in the zip)

```
docs/index.html              ← GitHub Pages deployment file (self-contained inline build)
src/App.jsx                  ← Entire prototype, ~5950 lines, single file
src/main.jsx                 ← Vite entry point
src/index.css                ← Base CSS reset
src/services/                ← Business logic (bundled into build)
  recommendationService.js
  persistenceService.js
  authService.js
  treatmentService.js
  catalogService.js
src/hooks/
  useRecommendations.js
src/data/
  communityData.js
  medicationCatalog.js
  procedureCatalog.js
  scanCatalog.js
  recommendationRules.js
  regimenDetails.js
  treatmentDetails.js
index.html                   ← Vite HTML entry
package.json
vite.config.js
HANDOFF.md                   ← this file
update-notes.md              ← changelog of prototype changes
```

All prototype UI code lives in `src/App.jsx`. Services, hooks, and data files are imported and bundled at build time.

---

## Build pipeline

### Stack
- React 18, Vite 6, single JSX monolith
- No TypeScript, no separate CSS files — all styles are inline JS objects

### Build command
```bash
npm run build
```
Vite outputs to `distN/` (e.g. `dist49/`). The `outDir` in `vite.config.js` must be incremented each build to avoid EPERM errors on already-existing dist folders.

### vite.config.js
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist49",  // ← increment this each build
    assetsInlineLimit: 10000000,
    rollupOptions: {
      output: { format: 'iife', entryFileNames: 'app.js', assetFileNames: 'app.[ext]' }
    }
  }
})
```

### Inlining to docs/index.html (GitHub Pages)

After each build, run this Python script to produce the self-contained inline file:

```python
html = open('dist49/index.html').read()
js   = open('dist49/app.js').read()
js   = js.replace('</script>', r'<\/script>')   # escape or browser parser breaks
html = html.replace('</body>', f'<script>{js}</script></body>')
open('docs/index.html', 'w').write(html)
```

**Critical notes:**
- The script tag must go before `</body>`, NOT in `<head>`. Without `type="module"`, scripts run synchronously — placing it in `<head>` means `#root` doesn't exist yet when React tries to mount.
- Vite's module preload polyfill contains literal `</script>` strings that break the HTML parser. The `.replace()` above escapes them.
- Shell-based `sed` replacement of `</script>` is unreliable due to quoting. Always use Python.

### Zip for sharing — "the commit files"

When the user asks to "package a zip" or "give me the commit files," always produce this exact set:
- `docs/index.html` (built, inlined GitHub Pages file)
- `index.html`, `package.json`, `vite.config.js` (build config)
- `HANDOFF.md`, `update-notes.md` (docs)
- the entire `src/` tree — App.jsx + services/ + hooks/ + data/ + main.jsx + index.css
- excluding `node_modules`, `dist*/`, `.DS_Store`, and any `*.backup*` / scratch files

```bash
rm -f /tmp/o4m-final.zip
cd <project root>
zip -r /tmp/o4m-final.zip \
  docs/index.html index.html package.json vite.config.js \
  HANDOFF.md update-notes.md \
  src \
  -x '*/node_modules/*' '*/dist*/*' '*.DS_Store' '*.backup*' 'src/App2.jsx'
cp /tmp/o4m-final.zip o4m-final.zip
```

**Why `src` (no trailing slash, no subfolder list):** zipping the whole `src` directory recursively captures every current AND future subfolder automatically. Do NOT hand-list `src/App.jsx src/services/ ...` — that silently drops any file not named, which is exactly how the services/hooks/data folders went missing between conversations.

**Verify before handing off:** run `unzip -l /tmp/o4m-final.zip` and confirm `src/services/`, `src/hooks/`, and `src/data/` files are all listed.

**Uploading back into a fresh chat — use a NEW filename each time** (e.g. `o4m-final-v1.3.zip`, `o4m-final-v1.4.zip`). The desktop app caches uploads by filename; re-uploading the same `o4m-final.zip` can silently serve a stale copy. A version bump in the filename forces the new file through.

Always delete the old /tmp zip first. Reusing an existing zip causes stale files to persist.

---

## Design tokens

All colors and visual constants are in the `C` object at the top of App.jsx:

```js
const C = {
  primary: '#ff7958',           // brand orange
  primaryLight: '#faeae9',      // light orange tint
  bgApp: '#F5F4F6',             // app background
  bgCard: '#ffffff',            // card background
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
```

---

## Key architectural patterns

### Experiments (variant flags)
Reversible variant switches live near the top of `App.jsx` (`EXPERIMENT_DEFAULTS` / `EXPERIMENT_META` / `exp()`), so new ideas slot in beside the existing behavior instead of replacing it. Every flag ships in the build — no rebuild needed to compare options.

- Read a flag with `exp('flagName')`; gate the variant JSX on its value.
- Defaults live in `EXPERIMENT_DEFAULTS`. Precedence: defaults ← in-app panel (localStorage) ← `?exp=` URL param (wins, for eng).
- **In-app panel:** Profile (You) screen → **Experiments** section renders a toggle per flag from `EXPERIMENT_META`. `setExperiment(key, value)` persists to localStorage and reloads (session + timeline survive the reload); `resetExperiments()` clears overrides.
- URL override still works for eng: `?exp=addressLookup:off` (comma-separate multiple: `?exp=addressLookup:off,foo:v2`).
- `EXPERIMENT_META` lists each flag's label + allowed values; add an entry here to make a new flag show up in the panel.
- **Prune rejected flags** — once an experiment is decided, delete the loser branch and the flag so `App.jsx` doesn't accumulate dead paths.
- Current flags:
  - `addressLookup` (`on` = Location step street field autocompletes; `off` = plain input).
  - `resourcesTab` (`on` = show the **Resources** tab in the bottom nav; default on). Filtered in `BottomNav` (`NAV_TABS` entries can carry a `flag`); content is a placeholder `ResourcesScreen` for now.
  - `engagementModal` (`on` = connect-records nudge after high-intent manual effort; `off` = never). A **signal** = a manually saved event (`handleComplete`) OR an **abandon**: selecting an event type (opening a FAB add-flow) and then closing it without saving (`closeAddFlow`). No confirm dialog is required — the intent is the type selection, the friction is bailing on the steps. (The "Leave without saving" confirm still only appears once there's actual input; that's separate from the signal.) Excluded: onboarding, system-generated, and chat-capture events. Gating is persisted (`ENGAGEMENT_KEY`, survives reloads) via `registerEngagementSignal`:
    - Shows after `ENGAGEMENT_SIGNAL_THRESHOLD` (2) signals.
    - After a show: resets the signal count, stamps `lastShownAt`, increments `shownCount`. Re-show requires the `ENGAGEMENT_COOLDOWN_MS` (7 days) to elapse **and** 2 fresh signals — plus never twice per session (`engagementShownThisSessionRef`).
    - Lifetime cap `ENGAGEMENT_MAX_SHOWS` (3); after that it stops.
    - **Terminal:** once records are connected (`markRecordsConnected()` — set by the chat connect-records action, read via `areRecordsConnected()`) it never shows again.
    - Dismiss is soft ("Not now" / close) only — no "don't remind me" yet.
    - **Records-not-synced card:** dismissing the nudge without connecting drops a persistent, dismissible card into the timeline directly below the daily summary ("Health records not synced" + "Open settings" → Profile). It persists across reloads (`cardActive`), hides once records connect, and closing it (`cardDismissed`) removes it for good. `RecordsNotSyncedCard` renders in `DaySection` on Today; App state `recordsCardVisible`.
    - **Testing:** Profile → Experiments → *Reset to defaults* also clears the engagement + records-connected state so the nudge can be re-tested (otherwise the 7-day cooldown blocks a quick re-show).

### State — all in App component
All state lives in the root `App` component. There is no Redux, no context for timeline state. Props are drilled down. Key state variables:

| Variable | Purpose |
|---|---|
| `timeline` | Array of day objects `{ date, label, isToday, events[], summary, suggested }` |
| `patientState` | Clinical profile derived from onboarding answers |
| `userDecisions` | Which recommendations the user has acted on |
| `highlightId` | Event ID to blue-highlight (set after add or undo, cleared after 3600ms) |
| `toast` | `{ message, action? }` — action has `{ label, onAction }` for undo |
| `flow` | Which add-event flow is open (`'appointment'`, `'medication'`, etc.) |
| `sheetOpen` | Whether the add-event sheet is open |

### Timeline data shape
```js
{
  date: '2026-07-25',          // YYYY-MM-DD local date string
  label: 'July 25',            // display label (legacy, mostly unused now)
  isToday: true,               // true for today's day section
  summary: null | { ... },     // daily summary object
  events: [
    {
      id: 'e1',
      type: 'appointment' | 'procedure' | 'scan' | 'medication' | 'diagnosis',
      name: 'Appointment with Dr. Chen',
      date: '2026-07-25',
      notes: '...',
      source: 'onboarding',    // only for DQ-seeded events
      // appointment-specific:
      provider: { id, name, specialty, ... },
      time: '14:30',
      appointmentType: 'In-person',
      location: '...',
    }
  ],
  suggested: null | { ... },   // recommendation suggestion block
}
```

### Date handling
- Always use `localDateStr()` — never `toISOString()` which can produce the wrong calendar date due to UTC offset.
- Events are created with `new Date(dateStr + 'T12:00:00')` to avoid timezone edge cases.

### Day label function
`dayLabel(dateStr)` returns `{ prefix, shortDate }`:
- `prefix`: `null` | `'Yesterday'` | `'[Weekday]'` | `'Tomorrow'` | `'Next [Weekday]'`
- `shortDate`: e.g. `'Jul 25'` or `'Dec 3, 2024'` (includes year if not current year)
- Today never calls `dayLabel` — it renders separately as "Today" in orange.

### Overflow menu
A module-level `_closeActiveMenu` ref enforces one open menu at a time. Menus are rendered via `ReactDOM.createPortal` to `document.body` to avoid clipping.

### Toast
```js
const Toast = ({ message, subtext, action, onDone }) => { ... }
// action: { label: 'Undo', onAction: () => { ... } }
// Timer: 3800ms with action, 2400ms plain
// pointerEvents: 'auto' when action is present
```
Toast is rendered at the App level: `{toast && <Toast message={toast.message} action={toast.action} onDone={() => setToast(null)} />}`

### Event highlight (blue fade)
```js
setHighlightId(event.id)
setTimeout(() => setHighlightId(null), 3600)
```
`highlightId` is passed down through `DaySection` → `AppointmentCard` / `EventCard` as a prop. Cards apply the blue background when `highlightId === event.id`.

### removeEvent (delete + undo)
```js
const removeEvent = (eventId, dayDate) => {
  setTimeline(prev => {
    const day = prev.find(d => d.date === dayDate)
    const ev = day?.events?.find(e => e.id === eventId)
    const origIdx = day?.events?.findIndex(e => e.id === eventId) ?? -1
    setToast({
      message: `${ev?.name || typeLabel} removed`,
      action: ev ? {
        label: 'Undo',
        onAction: () => {
          setTimeline(current => { /* restore at origIdx */ })
          setHighlightId(ev.id)
          setTimeout(() => setHighlightId(null), 3600)
        }
      } : null
    })
    return prev.map(...).filter(...)  // remove event, prune empty days
  })
}
```

### DQ (onboarding) events
Events with `source: 'onboarding'` cannot be deleted. Their overflow menu shows "Edit" instead of "Delete". Editing opens `ClinicalEditSheet`, which re-asks only the questions relevant to that event and rebuilds `patientState` + timeline seed events via `applyClinicalEdit(newAnswers)`.

### Notes truncation
`NotesDisplay` component uses `requestAnimationFrame` to measure `scrollWidth > clientWidth` after layout, setting `truncated` state. Expanded state uses `wordBreak: 'break-word'` + `overflowWrap: 'break-word'` to prevent card overflow.

---

## What's been built

1. **Appointment creation flow** — provider search (with "I don't know yet" skip), date, time, type, location, notes. `AppointmentCard` component renders appointments distinctly from other event types.
2. **AI Daily Summary card** — rule-based summary on Today section. Updates when timeline changes.
3. **Sticky date headers** — day section headers lock to top of scroll container.
4. **Today pill** — floating button when Today is off-screen, scrolls back to Today sentinel. Directional: appears when scrolling away, hides when scrolling back toward Today.
5. **Relative date labels** — Yesterday, Tomorrow, weekday names, Next [Weekday] within 7 days; short dates beyond.
6. **Editing DQ events** — `ClinicalEditSheet` with pre-populated answers, change detection, discard confirmation.
7. **Deleting user events** — overflow menu, day pruning, undo toast with name + position restore + blue highlight.
8. **Notes truncation** — "… more" / "show less" progressive disclosure.
9. **Clear date/time fields** — ✕ button on filled date and time picker inputs.

---

## Gotchas and known patterns

- **EPERM on dist folder**: Vite can't overwrite an existing dist dir. Always increment `outDir` in `vite.config.js` before building (dist49 → dist50, etc.).
- **App.jsx is one file**: Don't split it into components unless explicitly asked. The prototype trades maintainability for portability.
- **No external assets**: All icons are inline SVG. All styles are inline JS objects. This is intentional for the self-contained build.
- **localStorage**: Timeline, patientState, userDecisions, and medications are all persisted to localStorage on change via useEffect. `hydrateState()` loads them on mount.
- **Diagnosis events**: `type: 'diagnosis'` events never get an overflow menu. The ⋮ button is suppressed entirely.
- **Today section**: Always rendered even if empty. `isToday: true` day is never pruned by the filter that removes empty non-Today days.
- **`addedIds` prop**: Passed to DaySection to trigger `cardfadein` animation on newly added cards. Separate from `highlightId` (blue fade) — the card fade is a layout entrance, the blue fade is a "find this item" signal.
