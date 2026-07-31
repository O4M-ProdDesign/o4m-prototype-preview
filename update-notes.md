# Prototype Update Notes

## Appointment flow — "I don't know yet" provider skip
Added a secondary escape hatch below the provider list in the appointment creation flow. Users who don't yet know which provider they're seeing can tap "I don't know yet" to skip provider selection entirely and continue creating the appointment. The appointment saves without an associated provider and the card title falls back to "Appointment". The existing provider selection UI and Next button behavior are unchanged — the skip option is a secondary affordance below the list, not a list item, so users are still encouraged to select a provider when they know who they're seeing.

## Timeline section headers — relative date labels
Day section headers now use relative labels for dates within 7 days of today in either direction. Yesterday shows "Yesterday · [date]", days 2–7 ago show "[Weekday] · [date]" (e.g. "Monday · Jul 22"), tomorrow shows "Tomorrow · [date]", and days 2–7 ahead show "Next [Weekday] · [date]" (e.g. "Next Tuesday · Aug 5"). Dates beyond 7 days continue to use short date format only ("Jul 14", "Dec 3, 2024"). The label format is identical in the sticky (stuck) and natural (in-flow) states. Today's header is unchanged: "Today" in brand orange, middot in tertiary, date in primary.

## Notes truncation — progressive disclosure fix
Fixed two bugs with the "… more" / "show less" truncation behavior on event cards. Truncation detection now runs inside a requestAnimationFrame so the measurement happens after layout is complete, fixing cases where overflow wasn't detected on first render (e.g. medication cards). Expanded notes now use word-break and overflow-wrap so long text wraps within the card instead of blowing out the card's width.

## Delete event — undo action
Added an Undo button to the delete toast. Tapping Undo within the toast window restores the deleted event. The toast timer is extended to 3.8 seconds when an undo action is present (vs. 2.4 seconds for a plain toast). The event is restored to its original position in the day's event list, not appended to the end. The toast message shows the event's name (e.g. "Appointment with Dr. Chen removed") instead of the generic type label. On restore, the event receives the same blue highlight fade-in as a newly added event so the user can locate it immediately.
