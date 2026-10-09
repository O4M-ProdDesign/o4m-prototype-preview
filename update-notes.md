# Prototype Update Notes

## v2.44 — In-step trial option no longer lists trials; ctCard flag
- **"Clinical trial for … that has spread"** (option inside the NCCN Guidelines block) no longer shows matched trials, See all, or trial drill-ins. It's now just an example of clinical trials as an NCCN treatment option: title, Explain this treatment, description, NCCN source. Matched trials live only in the standing Explore clinical trials drill-in. Also fixed its copy rendering the stage as a stray lowercase letter ("operable i kidney cancer" → "operable stage I kidney cancer").
- **New flag `ctCard`** (Profile → Experiments, "Clinical trials card on timeline", default **on**). Off removes the standing Explore clinical trials card and its node from Today — the state for a cancer type with no trials available. URL: `?exp=ctCard:off`.

## v2.43 — Clinical trials node + card tint on #414652
The standing clinical trials node square is now `C.eyebrow` (#414652, was #5F7084), matching its eyebrow. The card's faint tint and border are re-derived from #414652 (7% fill, 18% border).

## v2.42 — Node glyphs #414652
Event and appointment node glyphs now use `C.eyebrow` (#414652, production's node icon colour), was 55% black. Suggested (orange `verified`) and standing trials (white on slate) nodes unchanged.

## v2.41 — Neutral eyebrows #414652
New token `C.eyebrow = #414652` (production's eyebrow colour). Applied to the neutral eyebrows: event/appointment type labels on timeline cards, the event type on the Details/Add date view, treatment option labels inside the NCCN block (ADJUVANT, SURVEILLANCE…), and the standing card's "Clinical trials" eyebrow. **NCCN Guidelines** stays orange as the recommendation-class signal; the orange parent-treatment eyebrow on regimen/medication detail is unchanged; section headings inside detail views are not eyebrows and are unchanged.

## v2.40 — Rail starts at the first item
The first item in the timeline (the diagnosis) no longer has a segment above it, and the first date has no segments. The rail begins at the diagnosis node and runs to the last item.

## v2.39 — Rail clearance + dates as stops
- **Clearance:** every line segment now stops `SPINE.clearance` (6px) short of whatever it connects — above and below each node (node height is measured, so 40/44/48px nodes all get the same gap), so the line meets the node rather than running behind it.
- **Dates are stops on the rail:** date headers are back to left-justified. The line ends 6px above the date label and resumes 6px below it (sandwiching it); nothing to the left of the date. The first date (diagnosis) has no line above it; the last item has no line below it.
- **Node-less banners** (records-not-synced) are treated the same way: the line stops 6px above the banner and resumes 6px below it, instead of passing behind it.
- **Date unknown** still has no rail.
- `SpineRow`: `through` replaced by `belowInset`; header uses a fixed 20px line height so the date's clearance is exact.

## v2.38 — One continuous rail across dates
The spine now runs unbroken from the first dated event (diagnosis) to the last, through every date header, instead of breaking at each day. Date headers moved into the card column (left padding = rail column + gap) so the line passes to their left; the sticky header draws its own rail segment so the line stays continuous when a header is pinned. `DaySection` takes `connectAbove` / `connectBelow`; `SpineRow` gained `through` (rail passes behind a node-less card) and its `below` segment ends at the row bottom when there's no gap. Node-less banners (records-not-synced) sit on top of the rail — the line passes behind them rather than stopping. **Date unknown** stays fully disconnected (header aligned with the cards, no rail).

## v2.37 — Date unknown: no connecting line
Events in the **Date unknown** section no longer connect to each other on the spine. Without dates there is no real order between them (only when they were added), so each keeps its node but the line is omitted. Spacing unchanged.

## v2.36 — Clinical trials drill-in: no share/bookmark in the app bar
Removed the share and bookmark buttons from the app bar of the Clinical trials drill-in (from the Explore clinical trials card on Home). A right spacer keeps the scroll-in title centered. Per-trial bookmark/share on the trial cards are unchanged, as are all other drill-ins.

## v2.35 — Session state held when leaving Home (drill-ins + scroll)
Leaving Home no longer throws away where you were. **See all** in the Clinical trials drill-ins (Explore clinical trials and the in-step trial detail) now switches to Treatment › Clinical Trials *without* closing the drill-in. Home drill-ins (treatment/trial details, Details/Add date) are wrapped so they stay mounted but `visibility: hidden` while another tab is active, so their state (scroll position, an open trial detail, bookmarks) is intact; tapping Home shows the drill-in exactly as left, and Back returns to the timeline at the same scroll position. Nested trial details now render inside their drill-in (PushLayer no longer portaled) so they hide/persist with it. Header/nav/FAB "drill-in open" logic only counts Home drill-ins while on Home (`homeDrillIn`). Home timeline scroll is also saved on tab-leave and restored on return as a safeguard. Other tabs were already kept mounted, so their own state persists for the session. Verified: scroll timeline → open Explore clinical trials → scroll → See all → Home (same drill-in, same scroll) → Back (timeline at same scroll).

## v2.34 — Clinical trials drill-in title
The drill-in opened from the **Explore clinical trials** card is now titled **Clinical trials** (page title and the app-bar title that fades in on scroll). The card on Today keeps "Explore clinical trials".

## v2.33 — Explore clinical trials: no docked footer button
Removed the docked **See all clinical trials** button from the Explore clinical trials drill-in only (See all next to Most Relevant Clinical Trials remains). Bottom padding and toast position adjusted for the missing dock. All other drill-ins unchanged.

## v2.32 — Drill-in app-bar titles: hidden until the page title scrolls away
All event/recommendation drill-ins now share one app-bar title behaviour (same as Explore clinical trials): no title in the bar at the top; once the page title scrolls up under the bar, the title fades in and the bar gets its hairline. Applies to **TreatmentDetailView** (suggested treatment), **RegimenDetailView**, **ClinicalTrialTreatmentDetail** (in-step trial option — previously had no bar title at all), **EventDetailsView** (Add date view — previously a static "Details"; the event name is now the bar title), and **CTExploreDetail**. Shared helper `scrolledPastTitle(scrollEl, titleEl)` replaces the IntersectionObserver versions (scroll containers set to `position: relative`). Also fixed TreatmentDetailView's bar: the invisible title was pushing the bookmark icon off the right edge (`minWidth: 0` on the title column). Not changed: TrialDetail (its bar shows the NCT ID) and its sub-pages (static section titles).

## v2.30 — Explore clinical trials: trimmed to trials + source
Removed **What This Approach Means**, **What to Consider** and **Questions to Ask Your Doctor** from the Explore clinical trials drill-in (and their `goals`/`overview` content). The view is now: title + description → Most Relevant Clinical Trials (or empty state) → source → docked See all clinical trials.

## v2.29 — Explore clinical trials: section title, source, empty-state flag
In the Explore clinical trials drill-in: section header **Clinical Trials Matched to You → Most Relevant Clinical Trials** (See all only shows when there are trials); source line → **ClinicalTrials.gov · U.S. National Library of Medicine**. New experiment flag **`ctMatches`** (Profile → Experiments, "Clinical trial matches (off = empty state)", default **on**). Off forces the empty state; the empty state (forced or real) keeps the "Most Relevant Clinical Trials" header and reads: "We didn’t find any currently available trials that match your clinical profile. Your care team may be able to help identify other options." Also works via URL: `?exp=ctMatches:off`.

## v2.28 — Records banner no longer connects to the rail
The spine line now only runs node-to-node: the "Health records not synced" banner (node-less) has no connector down to the first event, and the first event has no line above its node. Row spacing is unchanged (`SpineRow` takes `gapBelow` separately from the line).

## v2.27 — Records-not-synced icon matches node size
The "Health records not synced" card's icon is now 40px with a 22px glyph (was 48px / 20px), matching the timeline's event nodes.

## v2.26 — "Explore clinical trials" drill-in recycles the treatment detail view
Tapping the standing **Explore clinical trials** card now opens **CTExploreDetail**, built on TreatmentDetailView's layout, titling and slots (replaces the old CTSuggestedDetail): app bar (back; page title fades into the bar once scrolled past; share + bookmark) → **title + description** → options slot = **Clinical Trials Matched to You** (top 3 from `patientTrials`, the same `TrialCard`s used on the kidney in-step trial detail, each drilling into `TrialDetail`, with bookmark/share/notes shared via the existing `o4m_ct_*` storage; "See all" → Treatment › Trials) → **What This Approach Means** → **What to Consider** → **Questions to Ask Your Doctor** → guideline source line → docked primary button in the "Add to plan" slot: **See all clinical trials**. No-match state kept in the options slot. All copy lives in `CT_EXPLORE_CONTENT` and is placeholder pending final content. The app-bar title uses a scroll-position check rather than an IntersectionObserver (the observer misfired under the slide-in transform).

## v2.25 — Today label copy
Standing trials card: eyebrow **Treatment option → Clinical trials**, title **Clinical trials → Explore clinical trials** (stub option `phase`/`title` match). Suggested-treatments block eyebrow **Suggested treatments → NCCN Guidelines** (both the normal and the generating/shimmer state). Unchanged: the "Generating suggested treatments…" status line and the Clinical trials detail screen header.

## v2.24 — "Date unknown" section + minimal event details (date / notes)
New **Date unknown** section at the very end of the timeline for events with no date. They render as normal event/appointment cards on the spine; in the card's date slot they show an orange **Add date** link. Add date (and Edit from the card's ⋮ menu) pushes a minimal **EventDetailsView** ("Details"): type eyebrow + name, a **Date** field (existing DateInputField / iOS picker) and **Notes** (NotesTextarea), with Save enabled only when something changed. Saving a date moves the event onto the timeline at that date (creating the day if needed), scrolls to it, highlights it, and toasts "Date added · Moved to …". Saving notes only keeps it in Date unknown. The view is generic: saving a different date on a dated event moves it, and clearing the date moves it into Date unknown. Undated events persist under a new `careplan_v1_undatedEvents` key (cleared with the rest of persisted state; new users start empty). Demo account seeds two: *Renal ultrasound* (test, with notes) and *Urology consultation* (appointment). Removing one gives the usual Undo toast. Also: timeline bottom spacer 24 → 96px so the last card can scroll clear of the FAB + Today pill. Not yet done: add flows don't offer an "I don't know the date" path, so for now undated events only come from seed data (or by clearing a date in Details).

## v2.23 — Standing clinical-trials eyebrow: "Treatment option"
The standing Clinical trials card's eyebrow changes from **Encouraged** to **Treatment option** (and the stub option's `phase` to match). Context: the card is NCCN's standing, always-consider recommendation and is where users get a preview of matched trials (CTSuggestedDetail). The in-step trial option inside a cancer's suggested treatments (e.g. kidney) is separate — it's baked into that NCCN step and links to a generic page, and stays that way.

## v2.22 — Demo account gets its onboarding diagnosis event
The seeded demo timeline (`INITIAL_TIMELINE`, used for sign-in accounts like nick@demo.com) now starts with a dated **diagnosis event**, shaped exactly as onboarding seeds it (`seed_diag`, source `onboarding`, "Kidney Cancer", details Stage I · Clear cell histology), dated 28 days ago — ahead of the CT/surgery 6 days ago. Matches the demo patient state (RCC, Stage I, clear cell). Persistence `SCHEMA_VERSION` bumped 2 → 3 so browsers with a stored older timeline reset and pick it up.

## v2.21 — Daily summary removed from Today
The Daily summary card no longer appears on the timeline: Today's day object no longer carries `summary`, and `DaySection` no longer renders it. The records-not-synced card (previously gated on the summary being shown) now gates on `summaryShown` directly, so it still appears at the top of Today after the scroll-to-Today settles. `DailySummaryCard` and `buildDailySummary` are left in the source, unused, for easy restore. Note: this also removes the summary's empty-state **Add an event** CTA (the FAB remains).

## v2.20 — Event/appointment spine nodes on white
Event and appointment nodes are now a **white circle with a grey glyph** (was a hollow grey ring on the app background). Suggested stays distinct by size + orange `verified`; standing by the slate square.

## v2.19 — Spine refactor: every node on one rail
All timeline nodes now live on ONE rail outside the cards. **EventCard** and **AppointmentCard** no longer render their own `railIcon` node; the timeline row renders every item's node (`item.icon`) in the rail column for all item types. New **`SpineRow`** replaces the two old connector mechanisms (suggested rows' absolute node-column line at `top:-10/bottom:-22`, event rows' 32px gap segment at `paddingLeft:35`): one rail x (48px column, node centre at x=40 on a 390 viewport), one line mechanism (each row draws *above* = row top → node centre and *below* = node centre → next row's top). Nodes are **centred on the card**, or on the element marked `data-spine-anchor` — the SuggestedBlock header, measured at its **collapsed** height (body discounted to its 2-line clamp via `data-spine-clamp`) so the node doesn't jump on expand. Measured with a ResizeObserver, so alignment survives text wrap, expand/collapse and the reveal animation. **Class is signalled by node appearance** (`SPINE_NODE`): events/appointments = hollow ring on the app background with a grey glyph; suggested = solid white badge + orange `verified`; standing (trials) = slate rounded-square + `clinical_notes`. Line colour unchanged in spirit: grey between events, orange within suggested/standing, gradient across the boundary. Summary + records-not-synced cards stay full width with no node; the rail emerges from beneath them. The line runs within a day and stops at each day header (as before). Event card content width is effectively unchanged (the node moved out, the card moved right by the same amount). `RailItem` (unused) and `railIcon` (still used by sheets/pickers) left in place.

## v2.18 — Redesign handoff doc (for starting a fresh conversation)
Added `redesign-handoff.md` at the project root — captures the redesign goal, the timeline "past/present/future" thesis, the four business goals, the Option A iteration workflow + repo structure, the current prototype baseline, and the next step (share production feature inventory → build redesign-01). Included in the commit zip so a new conversation can pick up immediately. No app/behavior changes.

## v2.17 — Repo structure: iterations preview folder (no app changes)
Added `docs/iterations/` (with a README documenting the convention) so redesign iterations can each live in their own subfolder and publish at their own GitHub Pages URL (`…/iterations/<name>/`), while the current app stays at the repo root (`docs/index.html`) and the shared repo (B) is left flat/untouched. No prototype/behavior changes — structure only.

## v2.16 — Secondary-button treatment + Daily Summary empty-state copy
UI polish + copy. (1) **Secondary buttons** now use a **gray fill with orange text/icon** and a full pill radius, applied to the Daily Summary empty state's **Add an event** button (`ctaBtnStyle`) and the timeline **Health records not synced** card's **Open settings** button (was light-orange fill). (2) The connect-records nudge's primary **Connect medical records** button is now a **pill** (was a 14px rounded rectangle). (3) **Daily Summary empty state copy** reframed from the mechanical "Your summary will fill in as you add to your plan…" to a value-first line: **"See where your care stands at a glance — so it's not all in your head."** (the "Explore treatment options" state was already removed in v2.14; this is the single Empty state). Handoff board synced; the two tickets carry the interim copy and are being updated separately.

## v2.15 — No-cache meta tags (stop GitHub Pages serving a stale build to shared links)
Added `Cache-Control: no-cache, no-store, must-revalidate` (+ Pragma/Expires) meta tags to the page `<head>` (source `index.html`, carried into the built `docs/index.html`), so browsers re-fetch the HTML instead of serving a cached copy. This addresses shared-link recipients seeing an old build (missing modal, old nav, etc.). Note: GitHub Pages' CDN still caches each file ~10 min server-side, which meta tags can't override — for an immediate fresh load right after a push, share the link with a changing query string (e.g. `…/index.html?v=215`).

## v2.14 — Daily Summary: collapse Quiet + No-plan into one "Add an event" empty state
Removed the **"Explore treatment options"** CTA / Plan-quiet state from the Daily Summary. The card is now just **two states**: Rich (has a today/upcoming/added-treatment bullet → bullets + AI footer) and **Empty** (everything else — quiet *or* unsupported cancer → the single "Your summary will fill in as you add to your plan…" + **Add an event**). State logic simplified to `hasActionable ? 'rich' : 'empty'` (no longer branches on `cancerSupported`). This keeps one consistent empty CTA and pairs cleanly with the connect-records nudge (both funnel toward adding data). `onReviewRecs`/`cancerSupported` props on the card are now unused (left in place, harmless).

## v2.13 — Resources tab in bottom nav (feature-flagged, default on)
Added a **Resources** tab to the primary bottom navigation behind the `resourcesTab` flag (default **on**; toggle in Profile → Experiments). Icon `menu_book`, placed between Tracker and Community. `NAV_TABS` entries can now carry an optional `flag`, and `BottomNav` filters to `!flag || exp(flag)==='on'`, so flagged tabs drop cleanly when off. Content is a placeholder (`ResourcesScreen`) — icon + "Resources" + "Curated cancer guidance, articles, and support — coming soon." — matching how the Tracker was stubbed. App-bar title mapping updated for the new tab. Also flipped the `engagementModal` flag **default to on** (nav reordered to Home · Tracker · Chat · Community · Resources — Chat centered, Resources last). **Bug fix:** the engagement signal counter now correctly counts a combined total (2 of any mix of adds/abandons). A save unmounts the flow without going through the close handler, so its `flowJustCompletedRef` guard used to linger and swallow the *next* flow's abandon; the guard is now reset on every fresh flow open (`openFlow` / `openCaptureFlow`).

## v2.12 — Connect-records nudge: real bottom sheet + animated illustration + final copy
Replaced the placeholder engagement modal with the designed **bottom sheet** (`EngagementNudgeSheet`, slides up from the bottom, grabber, scrim). It carries the on-brand **animated SVG illustration** (record pops in centered → slides left → connector draws → a 3-item timeline scrolls up, one clips out, the two part, and the new orange card bounces in; plays once on open) and the final copy: **"See your care add up — without the typing"** / "Connect your records so it all comes together — the clearer the picture, the better your guidance and treatment options." Primary **Connect medical records** (simulated: marks records connected — terminal for the nudge and the records card, shows a toast), secondary **Not now** (dismisses → drops the persistent records-not-synced card as before). Still behind the `engagementModal` flag; all gating (triggers, cooldown, cap, terminal) unchanged. Animation CSS is namespaced (`.o4mplay`, `eng*` keyframes) to avoid collisions.

## v2.11 — Abandon signal = type selected + left without saving
Changed the engagement nudge's abandon definition. Previously an abandon only counted when the user confirmed the "Leave without saving" dialog (which required entered data). Now it counts the moment they've **selected an event type (opened a FAB add-flow) and then closed it without saving** — no confirm required, since the intent is the type selection and the friction is bailing on the multi-step flow. The confirm dialog itself is unchanged (still only shows once there's actual input). `closeAddFlow` no longer gates on `viaConfirm`.

## v2.10 — Engagement nudge gating (show / cooldown / re-show / cap / terminal)
Built the show-logic for the connect-records nudge (still behind `engagementModal`, default off). Goal: drive users to connect medical records once they show high intent through manual effort. A **signal** = a manual event saved OR a "Leave without saving" abandon (adds + abandons combined into one count, since both signal the same friction). Rules, all **persisted** (`o4m_engagement_v1`, survives reloads): show after 2 signals; after a show, re-show requires the 7-day cooldown to elapse **and** 2 fresh signals, and never twice in one session; lifetime cap of 3 shows; and **once records are connected it never shows again** (`o4m_records_connected`, set by the chat connect-records action). Dismiss is soft ("Not now"/close) only — no "don't remind me". The modal is delayed a beat after the action completes (`ENGAGEMENT_SHOW_DELAY_MS`, 1400ms) on **both** paths (successful add and confirmed leave-without-saving), so it never interrupts the sense of finishing. In the appointment flow, choosing **"I don't know yet"** for the provider now counts as progress (`providerStepDone`) just like selecting one — so leaving afterward triggers the "Leave without saving" warning (and thus the abandon signal). Tunable constants: `ENGAGEMENT_SIGNAL_THRESHOLD`, `ENGAGEMENT_COOLDOWN_MS`, `ENGAGEMENT_MAX_SHOWS`, `ENGAGEMENT_SHOW_DELAY_MS`. Profile → Experiments → *Reset to defaults* now also clears the nudge + records-connected state so it can be re-tested past the cooldown. Modal is still a placeholder. **Records-not-synced card:** if the user dismisses the nudge without connecting, a persistent, dismissible card drops into the timeline directly below the daily summary — "Health records not synced" / "You can sync your records in your profile under settings" / **Open settings** (→ Profile). It survives reloads, hides once records connect, and closing it removes it for good (no re-show for now). The card's "Open settings" button is a weighted-secondary (orange text on light-orange fill). Also aligned the **"Daily summary" card title** to the standard timeline-card title style (16px/600, -0.3px, primary).

## v2.9 — Engagement modal (feature-flagged) after 2 manual events
Added an empty placeholder **engagement modal** behind the `engagementModal` flag (default off; toggle in Profile → Experiments). It fires when the user **manually adds 2 events** to the timeline **or abandons 2 manual event flows**. An abandon counts only when the user confirms **"Leave without saving"** on the leave dialog — a plain close with nothing entered (no dialog) doesn't count. FlowShell now passes a `viaConfirm` flag through `onClose`. Counting is in-memory per session (`manualAddCountRef` / `manualAbandonCountRef`) and fires once. Adds are counted in `handleComplete`; abandons in a new `closeAddFlow` helper wired to all four FAB flow `onClose` handlers. **Excluded from the count:** onboarding events, system-generated events, onboarding medications (none route through these paths), and chat-capture adds. Recommendation/suggested-treatment adds (via `onAddToPlan`) are also not counted — the trigger is scoped to manual event creation via the FAB. Modal content is a placeholder for now.

## v2.8 — Experiments (variant flags) scaffold
Added a lightweight experiment-flag system near the top of `App.jsx` (`EXPERIMENT_DEFAULTS`, `EXPERIMENT_META`, `exp()`), so new variants can slot in beside existing behavior instead of replacing it. Flags ship in the build and are toggled at runtime via a URL param (`?exp=flag:value`, comma-separated for multiple); defaults live in code. First flag: `addressLookup` (`on` = Location step street field uses the autocomplete dropdown, `off` = plain input) — wired into the add-appointment Location step as the reference example. Added an in-app **Experiments** panel on the Profile (You) screen: a toggle per flag (from `EXPERIMENT_META`) that persists to localStorage and reloads (session + timeline survive), plus Reset to defaults. Precedence: defaults ← panel ← `?exp=` URL param. Pattern documented in HANDOFF.md ("Experiments"); rejected flags should be pruned so `App.jsx` doesn't accumulate dead paths.

## v2.7 — Add-appointment location step: editable prefill + address lookup + Skip
Reworked the Location step of the add-appointment flow. The read-only saved-address card and its temp edit sheet are gone; the step is now a single **editable form**, prefilled from the provider's catalog address when there is one. (1) **Catalog addresses now carry a ZIP** (and `parseProviderLocation` captures a trailing ZIP), so a catalog provider lands with a **complete** address and Next enabled. (2) **Street-address lookup:** the Street field shows a results dropdown as you type (stubbed `MOCK_ADDRESS_BOOK` + `searchAddressBook`; new `AddressAutocomplete` component); selecting a result fills street/city/state/ZIP. Typing with no match stands as a **custom** address. The lookup fires **only** from the street field — City/State/ZIP edits don't trigger it. (3) **Validation:** Next enables only when all four fields are filled; missing any field keeps it disabled. (4) **Skip:** a secondary button below Next, **always** enabled (even mid-validation); skipping saves no address whether prefilled or not. (5) **Save rule:** address is written only when the step ran, wasn't skipped, and is complete — skipped/non-location types save no location. Removed the ZIP→city/state API lookup and all edit-sheet state. Custom providers ("I don't know yet" / free-text) start with an empty form and the same street-field lookup. Ticket + handoff board (`ticket-add-appointment.md`, `add-appointment-handoff-board.html`) updated with the new location views/notes.

## v2.6 — remove "restore as a suggestion" note from delete sheet
Removed the "This will restore it as a suggestion" note under Delete in the event bottom sheet. The prototype still restores the recommendation when an added treatment is deleted (illustrative — production doesn't do this), but we no longer call attention to it.

## v2.5 — AI Daily Summary finalized to spec + timeline-event delete
**AI Daily Summary** brought in line with the Engineering Spec's state model and copy. (1) **States (per spec §3a):** the card always renders in one of — Rich (supported cancer with a today/upcoming/added-treatment bullet → the bullets), Plan-quiet (supported, nothing time-sensitive → "You have treatment options ready to explore…" + Explore treatment options, which scrolls to and gently gray-washes the first recommendation set), or No-plan (unsupported cancer → "Your summary will fill in…" + Add an event). Failure is deferred (not rendered). (2) **Collapse/expand and the failure UI removed** — the card is always expanded; change indication is inline only. (3) **Copy:** `plan_status` states verifiable history only and no longer asserts "treatment plan is active" (a prototype decision pending spec update). (4) **Change-marking:** changed bullets show an inline New/Updated tag that fades out once the card has been viewed; the summary now updates immediately even when adding an event scrolls it off screen. (5) **Recommendations gated to a supported-cancer allowlist** (RCC/Breast/Lung/Prostate/Bladder) — unsupported cancers get no plan anywhere.

**Timeline-event delete:** the card overflow (⋮) now opens the app's **bottom sheet** (trash + red "Delete", centered "Cancel") instead of a flyout, on both event and appointment cards; clinical/onboarding events show Edit instead. The delete toast now uses the **event type** ("Appointment removed", "Procedure removed", …) rather than the event title.

## v2.4 — AI Daily Summary rebuild (bullets, states, change-marking) + Today pill behind nav
Reworked the Daily Summary card toward the Engineering Spec. (1) **Structured bullets:** `buildDailySummary` now returns the spec's `{id, text, source_refs}` array — `plan_status` / `today` / `upcoming` / `treatments`, in order, max 4, omit-empty — and the card renders them as a bullet list. Copy rewritten to the plain-language standards (the old "your Stage I clear cell RCC plan" is gone); `plan_status` states only verifiable history and no longer asserts "treatment plan is active." Recommendations nudge dropped. (2) **Change-marking (simulated):** changed bullets carry an inline "New"/"Updated" tag at the end of the sentence with a primary dot; a collapsed unread dot sits by the chevron; marks clear once the card is viewed (localStorage last-seen, diffed by id+text). (3) **Card states:** empty state ("Your summary will fill in… + Add an event") and an interim failure state (message + Try again + a hidden preview hotspot). (4) **Today pill** now tucks behind the bottom nav (nav raised above the pill) instead of floating over it. NOTE: collapse/expand and the failure state are being removed in the next pass per the finalized state matrix; this commit captures the state before that change.

Batch of timeline + header polish since v2.2. (1) **App-bar title fix:** the header container was missing `position: relative`, so the centered title escaped to the app root and rendered mid-screen behind content — now shows correctly. (2) **Relative date labels — dropped "Next":** forward weekdays within ±7 days now render as a bare weekday (e.g. "Thursday · Aug 20") to match the backward side; "Next" was removed because it read as *next week* and clashed with genuine week-ahead days. (3) **Day-label off-by-one fix:** `dayLabel()` compared noon-of-date against midnight-of-today, so `Math.round` shifted every label one day forward (today rendered as "Tomorrow"). Now compares noon-to-noon. (4) **Content-first header type:** day headers are 16px/700 in secondary color with the middot at 12px/tertiary; "Today" is the same weight but brand-orange (color alone carries emphasis). Padding 16/16/12. Event titles now clearly lead the header. (5) **"Today" control (scroll-to-today):** reworked to position-based, keyed on today's own header vs the top edge — appears the moment today leaves its resting spot at the top in either direction, hides when it's back. Removed the earlier direction-based hide (flickered) and the "fully off-screen" test (failed to trigger on a side with less than a screen of content).

## Chat — navigation & transition rebuild (session: stack model)
Rebuilt the Chat tab's navigation as a proper layered stack (bottom → top: history menu → home → drilled chat), where sliding a layer aside *uncovers* the one beneath. The hamburger opens the history menu by sliding the home aside to reveal it underneath (menu reads as *below* the home, not a drawer over it); a light white scrim knocks the pushed-back home back. Each view carries its **own app bar** inside the sliding layer, so the bar travels with its screen — back-arrow slides in with a drilled chat and out with it on back, consistent both ways (no in-place icon swap). The footer nav now lives inside the home layer too, so it slides with the home and the menu runs full-height beneath it. Chat home is always the new-chat view; sending drills into a fresh conversation; back pops to the home. Drill-in/back run on ease-out (0.42s, cubic-bezier(0.32,0.72,0,1)). App-bar icons unified to the app gray (#414652), rounded, heavier weight via an aliased 600-weight Material Symbols face (the base package is static 400, so wght settings were no-ops). History list is white with a light hover/active state; "New chat" is a floating button at the bottom-left of the list. Daily summary now leads with the same three-sparkle `auto_awesome` AI mark used elsewhere, replacing the lone star. Compose (new-chat) icon added to the app bar; single-chat delete split from bulk delete in the tickets.


## Appointment flow — "I don't know yet" provider skip
Added a secondary escape hatch below the provider list in the appointment creation flow. Users who don't yet know which provider they're seeing can tap "I don't know yet" to skip provider selection entirely and continue creating the appointment. The appointment saves without an associated provider and the card title falls back to "Appointment". The existing provider selection UI and Next button behavior are unchanged — the skip option is a secondary affordance below the list, not a list item, so users are still encouraged to select a provider when they know who they're seeing.

## Timeline section headers — relative date labels
Day section headers now use relative labels for dates within 7 days of today in either direction. Yesterday shows "Yesterday · [date]", days 2–7 ago show "[Weekday] · [date]" (e.g. "Monday · Jul 22"), tomorrow shows "Tomorrow · [date]", and days 2–7 ahead show "Next [Weekday] · [date]" (e.g. "Next Tuesday · Aug 5"). Dates beyond 7 days continue to use short date format only ("Jul 14", "Dec 3, 2024"). The label format is identical in the sticky (stuck) and natural (in-flow) states. Today's header is unchanged: "Today" in brand orange, middot in tertiary, date in primary.

## Notes truncation — progressive disclosure fix
Fixed two bugs with the "… more" / "show less" truncation behavior on event cards. Truncation detection now runs inside a requestAnimationFrame so the measurement happens after layout is complete, fixing cases where overflow wasn't detected on first render (e.g. medication cards). Expanded notes now use word-break and overflow-wrap so long text wraps within the card instead of blowing out the card's width.

## Delete event — undo action
Added an Undo button to the delete toast. Tapping Undo within the toast window restores the deleted event. The toast timer is extended to 3.8 seconds when an undo action is present (vs. 2.4 seconds for a plain toast). The event is restored to its original position in the day's event list, not appended to the end. The toast message shows the event's name (e.g. "Appointment with Dr. Chen removed") instead of the generic type label. On restore, the event receives the same blue highlight fade-in as a newly added event so the user can locate it immediately.

## Chat feature — P0 vertical slice
Added a center **Chat** tab (speech-bubble icon) to the bottom nav, between Track and Community. The tab opens directly to the unlocked chat home — the locked/gating state is intentionally deferred pending a product decision on the unlock model (hard lock vs. safety-floor + capability gradient). Chat home shows a "Start a new chat" CTA, four personalized suggested-question chips (guided entry, drawn only from safely-answerable question clusters), and a recent-history list (in-memory for P0). Tapping a chip or the CTA opens a session.

The "LLM" is simulated, mirroring the Daily Summary pattern: `routeChat()` is a client-side rule engine keyed off the question map. Each typed message is classified — hard-stop / needs-data / insufficient-data / answer — and returns a response payload plus which components attach. Hard-stops are evaluated first (safety). Response components built for P0: cited answer (inline source line), tappable deep link (wired to real screens — Track, Community, treatment plan, profile — and toast-stubbed for nurse/trials/mood), persistent care-team prompt on clinical answers, warm hard-stop redirect with a priority "Chat with a nurse" CTA (four refusal patterns: prognosis / treatment change / interpret-results / second-opinion — the second-opinion pattern deliberately routes to the nurse, not the primary provider), and the Scenario-A insufficient-data prompt (no records connected) with a connect-records deep link. Deep links open in-app; the nurse CTA is styled as a prominent handoff, never an error state. Simulated generation shows a typing indicator during an ~0.9s async delay. Distress/emergency escalation and proactive data capture are P1, not in this slice.

## Chat P0 — polish & refinements (session 2)
Chat tab icon switched to the 3-star `auto_awesome` sparkle. Reworked the Chat home into a centered starter (greeting "Hi {first name}, ready when you are." + composer + suggested prompts) with a bottom-anchored legal footer; new chats open as a slide-up FlowShell modal, chat list is divider rows with a "+ New chat" FAB, and drill-into-chat uses a shared-header back with a horizontal push. Composer redesigned (send button inside, taller). AI responses now render Claude-style inline (no bubble, no per-message label); user messages are light-orange bubbles. Thinking indicator is the pulsing sparkle. Chat-history titles are now topic labels derived from the router's classification. Added insufficient-data Scenario B (records connected but data missing) via a simulated `recordsConnected` flag that the Scenario-A connect action flips. Legal footer ("Chat is AI and can make mistakes. Always confirm care decisions with your care team.") on the starter and under the composer. Removed the per-response care-team CTA and the passive feature deep links (kept the hard-stop nurse CTA and the connect-records prompt). White chat background. Verified via code review; fixed persist-on-mount re-dating, lost-reply-on-early-close, and session-id collision.

## Chat P0 — full map routing, in-chat capture, chat management (session 3)
Wired the simulated router to the full question map v1 so every example resolves instead of hitting the generic fallback: added patient-data answers for "what stage am I" and "what meds am I on" (medications threaded into chat context), procedure education (surgery approaches), treatment-options / NCCN-guideline answers, and a clinical-trials answer. Added lightweight in-chat capture: first-person statements (new medication / symptom / appointment / clinical detail) return a short reply plus an inline "Want me to add this to your [log]?" confirm (P0 stand-in; the P1 build is slide-up-and-return). Renamed the tab and screen to "Chats"; removed the "Your chats" list subheader. Titles now show only on the chat list — the start-a-conversation view (empty starter and the new-chat modal) and drilled-in chats show no title. Added chat management: drilling into a chat shows a ⋮ overflow in the shared app bar that opens a flyout with a red "Delete", which opens a confirm modal ("Are you sure you want to delete "{title}"?") using the Cancel/Delete dialog pattern; confirming removes the chat and returns to the list.

## v2.16 line (pre-redesign baseline) — Clinical Trials
### Treatment tab scaffold
Added a "Treatment" primary-nav tab (Home · Treatment · Tracker · Chat · Community) with a secondary segmented nav (TreatmentScreen, same pattern as Tracker); for now the only entry is "Clinical Trials", shown for all cancer types. Clinical Trials content is a placeholder pending the reference UX (video + card screenshot) — full build to follow: Recent/Relevant/Nearest folder tabs, filter panel, the existing card (bookmark/share/hide), and the 5 detail views (About/Locations/Questions to Ask/Eligibility/My notes) from clinicaltrials.gov. Context captured in clinical-trials-notes.md. (Baseline stamped v2.16.)

### v2.16 — Clinical Trials management built (from reference video)
Replaced the placeholder with a faithful rebuild of the existing Clinical Trials UX:
- List with Recent / Relevant (default) / Nearest folder tabs, results count, and a "connect your records for more accurate matches" banner.
- Score-badged trial cards: title, description, chips (stages/menopause/HER2/HR/recurrent), and an action row (bookmark / share / hide) with the PHASE badge; Nearest shows mileage.
- Filters sheet (slide-in): Interventional / Non-interventional / Exclude Surgery / Exclude Radiation / Phase 1–4 / Show Hidden + Save.
- Actions: bookmark → toast; share → native share / clipboard; hide → "Hide this trial?" confirm (with the "Show Hidden in Filters" note). Bookmarks/hidden/notes persist (localStorage).
- Trial detail: header (NCT id + bookmark), title/desc, 5 chained rows — About (sponsor/contacts/investigators) · Locations (map block + location card) · Questions to Ask · Eligibility (collapsible Inclusion/Exclusion) · My notes (list + add-note editor with title/notes/submit) — attributed to ClinicalTrials.gov.
- Seeded ~6 realistic trials (all cancer types in the prototype; real matching/.gov is server-side).
Next: reuse the trial card inside suggested treatments on the Care Plan (NCCN now includes trials).

### v2.16 — Clinical Trials: push transitions on drill-in
Drilling into a trial (card → detail) and into detail sub-views (About/Locations/Questions/Eligibility/My notes) now use the app's push transition (slide in from the right, slide back out on back) via a reusable PushLayer, instead of instant swaps. Detail list stays underneath; sub-views push over it; "next" links push the following section in.

### v2.16 — Clinical Trials: trial detail is a full-screen view (own header)
The trial drill-in now pushes in as a root-level full-screen view (PushLayer fixed, portaled, z120) that covers the shared Treatment app bar and bottom nav — so it uses only its own header instead of stacking under the Treatment header. Sub-views continue to push within that full-screen detail.

### v2.16 — dev: Clear all demo data
Added a "Clear all demo data" button to Profile → Experiments (wipes localStorage + sessionStorage and reloads) so the logged-in demo can be reset to a clean slate — useful when the treatment plan/state is stale. After clearing, onboard as a new user with a supported cancer to see the treatment plan.

### v2.16 — rename treatment-plan eyebrow to "Suggested treatments"
Changed the SuggestedBlock parent-card eyebrow from "RECOMMENDED NEXT STEPS" to "SUGGESTED TREATMENTS" (keeps the group title, e.g. "Next Steps After Primary Treatment"), and updated the block's generation copy to "Generating suggested treatments…".

### v2.16 — clinical trial as a suggested treatment: detail + drill-ins (from video 2)
When a suggested treatment is a clinical trial, tapping it now opens a detail matching production (ClinicalTrialTreatmentDetail), instead of the regimen-oriented view: title → "Explain this treatment" (opens a streaming Treatment Plan Agent sheet: Personalizing…/Processing…/Clarifying… → "Understanding Your Treatment Options for {stage} {cancer}") → clinical-trials body copy → a "Clinical trial" drill row (→ info: body + Category 2B) → NCCN Source citation (Category 2B, referenced-with-permission, ©NCCN, NCCN.org). Cancer/stage templated from patientState (defaults to kidney cancer for the demo). Timeline/suggested-treatments list UI unchanged; branch triggers on clinical-trial options (title/phase/subtitle).

### v2.16 — surface real matched trials inside the clinical-trial treatment detail (Option A)
The clinical-trial suggested-treatment detail now shows the actual most-relevant trials for the patient (top 3 by score) as real trial cards — "Clinical trials matched to you" with a "See all" → the Clinical Trials tab — instead of only generic info. Each card opens the full trial drill (About/Locations/Questions/Eligibility/My notes); bookmarks/notes shared with the Clinical Trials tab via localStorage. Unburies trials at the exact stage/spot in the plan while keeping the guideline structure + NCCN source. (Option B — replacing the timeline card with a couple of live trials + See more — noted as a bolder alternative to test, better suited to the redesign line since it changes the timeline UI.)

### v2.16 — detail section titles promoted to heading scale (title case)
The all-caps secondary section labels in the treatment-option detail and the trial detail sub-views were hard to parse. Promoted them to a heading-scale style (18px/700, -0.3px tracking, textPrimary, title case) so sections are clearly distinguished: Treatment Options, What This Approach Means, What to Consider, Questions to Ask Your Doctor, Clinical Trials Matched to You, Lead Sponsor, Contacts, Clinical Investigators, Source.

### v2.16 — clinical-trial suggested-treatment card: headline + copy
Card headline now matches the drill-in title ("Clinical trial for kidney cancer that has spread"; breast: "…for metastatic breast cancer") and the description no longer repeats "clinical trial" ("Experimental therapy with the goal of improving outcomes." / kept "Access to investigational treatments" for breast). Dropped the duplicate "CLINICAL TRIAL" phase eyebrow on these options (title now carries it). Detail branch detection still matches via the title.

### v2.16 — deterministic clinical-trial matching (by cancer type)
Replaced the static-score stand-in with a deterministic prototype scorer. Each seed trial is tagged with a cancer type (diagnosisCode) + applicable stages (+ optional markers/menopause). Added a kidney (RCC) trial set alongside breast. patientTrials(ps) filters TRIAL_SEED to the patient's cancer type; scoreTrial(trial, ps) scores by stage overlap (+2) and marker/menopause matches (+1 each). Clinical Trials list (Relevant sort) and the "Clinical trials matched to you" section in the treatment detail now reflect the patient's actual cancer/stage — a kidney patient sees kidney trials, a breast patient breast trials, ranked by fit. Not the production algorithm, but real against the seed. Cancer label fixed to map from diagnosisCode.

### v2.16 — clinical trials empty state (cancer types without seeds)
Since trials now filter by the patient's cancer type and only kidney (RCC) + breast are seeded, other cancer types showed a blank list. Added an empty state: "No clinical trials matched to your profile yet — kidney and breast have seeded trials; more cancer types coming." (So a kidney/breast patient sees matched trials; others get an honest message instead of blank.)

### v2.16 — make the clinical-trial suggested treatment easy to see
The clinical-trial option was gated (RCC stage I–III + a primary treatment already on the plan; breast stage IV + no systemic yet), so it was buried and didn't show for many states (e.g., stage IV). Relaxed both conditions to just the cancer type — the clinical-trial card now appears in the suggested treatments for any kidney (RCC) or breast patient immediately, tappable into the detail with matched trials. (Grouping can be refined later; this is for visibility.)

### v2.16 — records-not-synced takes top position under Today
Reordered the Home/today stack so the "Records not synced" card leads (top under Today) with the daily summary second. When the card is dismissed (or records are connected), the summary naturally returns to the first position.

### v2.16 — engagement signal now includes recommended-treatment intent
Adds from recommended treatments already counted (they route through handleComplete → signalEngagement). Wired the missing half: abandoning a recommended-treatment add-flow (and the regimen sub-flow) now also registers a signal (onAbandonSignal → signalEngagement) toward the connect-records modal. So the modal's 2-signal threshold now accrues from any mix of manual adds/abandons and recommended-treatment adds/abandons — matching the ticket.

### v2.16 — connect-records modal copy (benefit-forward, no "typing")
Updated the engagement modal copy: headline "See your care come together — automatically"; body "Connecting your records pulls your history in for you — so your care plan, treatment options, and trial matches become more complete and personalized to you." Removes the "without the typing" reference (the prompt can now trigger from recommended-treatment adds where no typing happens) and foregrounds the benefit of connecting. Ticket updated to match.

### v2.16 — connect-records modal: punchier, payoff-led + trust cue
Tightened the modal copy (Uber/Airbnb style — one concrete payoff up top, friction relief in the body): headline "Better guidance, built on your full record"; body "Connect once and we'll bring your history in for you, no manual entry." Added a small "Private and secure" trust cue with a lock glyph beneath the Connect button (health-data reassurance). Ticket updated to match.

### v2.16 — connect-records modal: removed the trust cue
Kept the punchier copy (headline "Better guidance, built on your full record"; body "Connect once and we'll bring your history in for you, no manual entry.") and removed the lock + "Private and secure" line under the Connect button. Ticket updated.

### v2.16 — connect-records modal body tightened
Body is now "Connect once and we'll bring your history in for you." (dropped "no manual entry" — not a promise to make, and it removes the awkward two-line wrap). Ticket updated.

### v2.16 — connect-records modal: more direct (Apple-style)
Headline now names a concrete outcome instead of an abstract promise: "See your whole care picture in one place"; body "Connect your records and we'll bring your history together for you." (Removes the inference from "built on your full record"; makes clear the app does the aggregation.) Ticket updated.

### v2.16 — connect-records modal headline
Headline → "Everything about your care, in one place." (Apple-Health echo), keeping the body "Connect your records and we'll bring your history together for you." Ticket updated.

### v2.16 — dev: Reset records nudge
Added a "Reset records nudge" button to Profile → Experiments that clears the engagement state (shown-count/cooldown) + records-connected flag and reloads, so the connect-records modal trigger can be re-tested without wiping the whole demo. (The modal fires after 2 signals from any mix of manual/recommended adds or abandons, then is gated by cooldown + a lifetime cap of 3 — which is why it stops showing after testing.)

### v2.16 — connect-records modal: scrim gate + settle-based show (no fixed delay)
Scrim tap-to-close is disabled until the sheet has fully appeared (~420ms after mount; pointer-events off + no handler until then), so a stray tap during the slide-in can't dismiss it. Removed the fixed 1.4s show delay: a fired signal is now held and the modal appears only once nothing else is open/in progress (no flow/sheet/detail/summary overlay), driven by the drill-in state — so it never interrupts an in-flight action or a just-tapped process.

### v2.16 — Medical records connect landing + modal/card wiring
Built the "Connect your medical records" landing (from production): records illustration, headline, 3 value props (summary of your oncology records / better conversations with doctors / protected health information), and a Connect button. Wired the records-CTA modal's "Connect medical records" and the "Records not synced" card's Connect to open this landing (previously the modal marked connected directly / the card opened the account screen). The full multi-step intake (patient info → address → provider → Dropbox Sign) is stubbed: Connect goes to the "Your medical records are being retrieved and processed" confirmation → "Go to results" marks records connected, hides the nudge card, and toasts. Discovery-only trials work untouched.

### v2.16 — Medical Records tab in Treatment
Added "Medical Records" as the first tab in the Treatment segmented nav (Medical Records | Clinical Trials), defaulting to it. The tab renders the connect landing (illustration + 3 value props + Connect) → "records being retrieved" confirmation, reused from the modal via a shared MedicalRecordsConnectBody. Connecting from the tab marks records connected. The modal/card still open the same landing as a full-screen sheet.

### v2.16 — Medical Records: real landing + full connect flow (from Medical_Records.mov)
Replaced the stub with the production landing (centered value props, no icons, folder illustration, dark navy Connect) and the full multi-step flow: (1) landing → (2) Patient information (legal name, maiden/other, DOB, last-4 SSN) → (3) Home address (autocomplete suggestions → fields) → (4) Name of provider or facility (search → select "Mary Smith CRNA", tip, up to 3) → (5) Signature intro → (6) Dropbox Sign mock (HIPAA Patient Access Request summary + signature pad canvas + Insert → "Almost done" → I Agree) → (7) "Your medical records are being retrieved and processed" + "For more accurate results" rows → Go to results (marks connected). Shared MedicalRecordsConnectFlow powers the Treatment "Medical Records" tab and the modal/card full-screen sheet, with step back-navigation.

### v2.16 — Medical Records tab lands at the beginning
The Medical Records flow now always opens at the landing (step 0), regardless of whether records were previously connected — it was jumping to the end (retrieval confirmation) when the connected flag was set.

### v2.16 — Medical Records flow pushes as its own stack
Split the landing from the multi-step form. The landing stays on the Medical Records tab (and in the modal); tapping Connect now pushes the form (patient info → address → provider → signature → Dropbox Sign → confirmation) as its own full-screen stack with its own back header, just like drilling into a clinical trial (PushLayer fixed). Back from step 1 slides the stack off and returns to the landing; back within steps goes to the previous step; "Go to results" marks connected and closes the stack.

### v2.16 — modal/card Connect skips the landing
Tapping "Connect medical records" in the engagement modal (and the "Records not synced" card) now opens the multi-step form flow directly (patient info first) instead of re-showing the landing — the user already expressed intent. The Medical Records tab still opens on the landing as the discovery entry. Back from step 1 closes the sheet.

### v2.16 — records flow: abandon = Not now + right-push
Abandoning the connect-records flow (modal/card path) at any point before completing now behaves exactly like "Not now": it activates the persistent "Records not synced" card above the daily summary (activateRecordsCard + setRecordsCardVisible), guarded by a completion ref so a completed flow doesn't. The MedicalRecordsConnectScreen now pushes in from the right (translateX) with the standard drill easing + left shadow, matching production, instead of sliding up from the bottom.

### v2.16 — records flow reworked to spec
- Flow slides UP from the bottom on launch; completing or dismissing slides it DOWN.
- X to close in the top-right on every step; no back button on the first screen; back (top-left) on steps 2+.
- Abandoning after entering any info shows a "Leave without finishing?" warning (Stay / Leave); leaving runs the same logic as "Not now" (activates the timeline card). No warning if nothing entered.
- Same slide-up flow is launched from the modal, the timeline card, AND the Treatment › Medical Records landing "Connect" (all via one App-level MedicalRecordsConnectScreen).
- Timeline "Records not synced" card button changed from "Open settings" to "Treatment"; tapping it navigates to Treatment › Medical Records (landing), not the flow directly.

### v2.16 — records card button label
Renamed the "Records not synced" card button to "Go to Treatment / Medical Records".

### v2.16 — engagement modal gate: blocking-surface based, not tab
Changed the deferred-show gate from anyDrillInOpen (effectively "on Home") to a dedicated engageBlocked check: suppresses only while a blocking surface is open (add flow, sheet, pushed detail, records-connect flow, clinical-edit sheet, or the modal itself) and otherwise shows on whatever top-level tab the user is on the moment those close. Adds showConnectRecords + clinicalEditEvent to the suppression set so the nudge can never fire over the records flow. Keeps the double-rAF settle so it doesn't collide with a closing animation.

### v2.16 — records card button → "Go to Treatment"
Shortened the "Records not synced" card button from "Go to Treatment / Medical Records" to "Go to Treatment" (prototype, ticket, handoff board).

### v2.16 — banner nudge restyled (quieter than event cards) + copy
Records-not-synced banner: headline 15→14/700, body 13→12.5, button label 13→12/700 with explicit 36px height — a step below the event-card scale (16/14) so the nudge reads as chrome, not a care event. Icon chip stays 36 (one step under the 48 spine nodes). Body copy → "Sync your records to make your plan even more complete. You can do this any time under Treatment." Handoff board + ticket synced.

### v2.16 — banner button 28px
Dropped the records-not-synced banner button to 28px tall (from 36) to match the 12px label + the 28px dismiss-X tap target and the quieter nudge scale. Icon glyph 20 (in 36 chip); X glyph 18 (in 28 tap).

### v2.16 — records banner moved above the timeline
Moved the "Records not synced" banner out of the Today day-section (was the top spine slot) to its own band above the timeline scroll, ahead of the first day. Rationale: it's an important but dismissible system nudge — placement above the spine differentiates it from care events (the summary still sits at the top of the timeline, no node), so it doesn't need a loud surface. Kept the calm styling. Summary returns to the top of the timeline.

### v2.16 — reverted: records banner back on Today
Reverted the above-timeline move. The "Records not synced" banner is back in its Today top slot (above the daily summary), per prior behavior.

### v2.16 — banner final sizes
Records banner locked to: headline 14/700, body 12, button 12/700 at 28px tall, icon chip 36 (glyph 20), dismiss X 28 tap / 16 glyph.

### v2.16 — banner matched to event cards
Records banner now matches the timeline event scale: icon chip 48×48 (= spine node size, glyph 20), headline 16/600 (−0.3 tracking, lh 1.3, = event title), body 14 (= event body), button 36px tall / 13/700. (Reverses the earlier quieter-than-events treatment per direction change.)

### v2.16 — modal animation recolored to match records artwork
Aligned the connect-records modal illustration to the medical-records folder artwork palette: accent orange #ff7a59 → #f47a56; timeline node dots → folder blue-gray #a6b7ce; the record card → cream #f2ece3 (document) with an #f47a56 EKG line; new-entry row softened (#fdf1ec / #f3c9bd / #eda58e). Applied to the prototype modal + the RN handoff deliverables (playable reference, start SVG, final-frame SVG).

### v2.16 — modal animation: record card back to white
Reverted the record card to white (keeping the rest of the artwork-palette alignment: blue-gray nodes, #f47a56 orange).

### v2.16 — connect flow terminal button → "Done"
Relabeled the flow's final button from "Go to results" to "Done" (records take days to process — nothing to "go to" yet; and users arrive from 3 entry points). Behavior unchanged: it dismisses the slide-up sheet back to wherever the user came from (Home / landing / timeline card) and marks records connected; the status shows ambiently (banner gone, Medical Records tab shows connected state).

### v2.16 — connect flow confirmation trimmed
Removed the "For more accurate results" list from the flow's confirmation view — it's now just the status + Done (which returns the user to origin). Design thought captured in the handoff board: those accuracy options move to the Treatment › Medical Records landing (as the connected status + accuracy home).

### v2.16 — success screen: no toast, no back
Removed the "records connected" completion toast (the success screen already tells the user). Removed the back button on the success screen (step 6) — can't go back after completing; the X there completes+closes (no leave-warning) same as Done.

### v2.16 — Medical Records landing reflects connected status
When records are connected/requested, the Treatment › Medical Records landing now shows the completed status (check + "being retrieved and processed" + copy) instead of the value props, and keeps the Connect button at the bottom. Reads areRecordsConnected() at render, so it updates after completing the flow.

### v2.16 — remove hide from trial previews in the treatment detail
The matched trial cards in the clinical-trial treatment detail no longer show the "hide" affordance (TrialCard renders hide only when onHide is provided; the detail view drops it). Hide remains available on the Clinical Trials tab, per the ticket. Bookmark + share stay in the detail.

### v2.16 — "See all" matched trials → Treatment / Clinical Trials
The "See all" link in the clinical-trial treatment detail's "Clinical trials matched to you" now lands on Treatment › Clinical Trials (previously it went to Treatment, which defaulted to the Medical Records sub-tab). Lifted the Treatment sub-tab to App state so See all can set it to 'trials'.

## v2.18 (trials line) — Clinical Trials as a standing recommendation on Today
- Persistent "Clinical trials" entry: always the FIRST suggested item on Today, even with no other recs. Not a step-with-sets — a single flat standing card (CTStandingCard) that opens a detail.
- Card: "Encouraged" eyebrow, "Clinical trials", NCCN copy. Neutral slate treatment (#5f7084), NOT the orange accent (reserved for act-on-this). Built as a reusable "standing recommendation" style (icon differentiates type when it scales; clinical_notes for trials — note the app's icon font is REDUCED/subset, new glyphs render blank unless added).
- Detail (CTSuggestedDetail): hierarchy = Why this matters (NCCN) → Trials that may match (up to 3, phase/name/location/reason) with "See all" up by the title (Apple pattern) → no-match state ("No matching trials found" + reassurance + "Search all clinical trials"). Routed via opt.kind === 'ct-suggested'.
- Suggested treatments node: white badge with an ORANGE verified icon (was orange-outlined star).
- Spine experiment (IN PROGRESS, needs the refactor below): suggested nodes moved OUT of the cards onto the spine (rail column), with a continuous line down the node column, node centered on the parent/collapsed card. Event + appointment nodes are STILL baked inside their cards, so the event↔suggested boundary jogs.
- DECIDED NEXT (own task): pull ALL node icons out of the cards (events + appointments too) so the whole spine is one rail; signal class (event vs suggested vs standing) via node appearance, not inside/outside. This is a real refactor of EventCard/AppointmentCard + the connector/line logic.
