# Prototype Update Notes

## v3.00: Chat on Resources

- The header's Chat button now shows on Resources too, so it's on every main section: Today, care plan, Tracker, Community and Resources.

## v2.99: care team prompt is a short message from chat, then the button

- After the first clinically related answer in a conversation, chat adds a short follow-up message that says why: "If you'd like to ask Dr. Chen about this, you can share your question with them." (or "…your care team…" without a doctor's name), then the "Share with your care team" button. Once per conversation, 16 below the answer.
- Replaces the gray "Have a question for your care team?" line, which read as fine print. Same pattern as "Go to Community": chat says why, then offers the link.

## v2.98: Delete above Cancel

- The delete dialog lists "Delete" first (red secondary) and "Cancel" below it (dark blue primary), so a quick tap at the bottom lands on the safe choice. Styles unchanged.

## v2.97: save symptoms from chat, using the app's "Log a symptom"

- Mentioning a symptom ("I've had a headache all week") offers "Want me to add this to your symptom log?" with "Add it" and "Not now".
- "Add it" opens "Log a symptom", matching the production app: a full view over chat (chat steps back and dims), date and time, an alphabetical checklist, and checking a symptom expands Severity (Mild, Moderate, Severe, Very Severe), a note and photos. Pre-filled: the symptom they mentioned is checked, and their words are in the note; severity is theirs to choose.
- Submit shows the app's dialog ("Would you like to see recommended solutions for easing this symptom?", with its disclaimer), then saves to the symptom tracker only (no timeline event) and returns to chat: "Your headache is saved. It'll show in your symptom tracker."
- Before, "Add it" only replied "Got it, I'll keep that in mind", and saved nothing. The symptom reply no longer has an em dash.

## v2.96: missing-information questions read as questions

- Records: "To answer this, I need your health records. Want to connect them?" with "Connect my records" and "I'd rather not".
- A missing detail: "I need a detail your records don't have. Can you tell me, or connect where it's held?" with "Tell you myself", "Connect another portal", "I don't know" and "I'd rather not".
- Every answer, including the "no", reads as a direct reply to the question.

## v2.95: after connecting, chat offers to answer with one tap

- After "Connect my records": "Thanks. Your records are on their way. Once they're in, I'll offer to answer this." (no longer "ask me again").
- When records are in (simulated with a short wait), the question box asks: "Your records are in. Want me to answer "How am I responding to treatment?" now?" with "Yes, answer it" and "Not now". Yes answers the original question; nothing is answered automatically. "Not now": "No problem. Just ask whenever you're ready."

## v2.94: Ask O4M and the profile open as full views from chat

- Flows chat starts slide up as a full view (no partial sheet, no detent), with chat stepping back and dimming behind them as they open.
- Ask O4M and the profile, when opened from chat, now present as full views: no grab handle or rounded top, a close button at the top. Opened elsewhere, they keep their existing sheets.

## v2.93: nurse request wording

- Asking for a nurse or a person: "You can send your question to our clinical team, and they'll get back to you." (no longer mentions a live nurse chat), then the clinical team question.

## v2.92: care team prompt uses the share sheet

- On clinically related answers (the ones with a source), a quiet row: "Have a question for your care team?" with a "Share with your care team" pill (chat's secondary, share icon). It was never rendered before.
- We don't have the care team's contact details, so it uses the phone's share sheet, like the app's AI agents: "Hi Dr. Chen, I have a question: "[their question]"" is filled in, and the person picks how to send it, or copies it. Where the browser can't share (desktop), it copies the text and says so.

## v2.91: Ask O4M is a last resort

- Ask O4M goes to our clinical team, who answer later. It isn't crisis help, and it's a last resort: offered only for a hard stop or when someone asks for a person (a nurse, a doctor), never proactively.
- Emotional difficulty that isn't a crisis ("This is so hard, I'm scared") now gets a warm acknowledgment and a "Go to Community" link, with no Ask O4M offer, and the conversation continues. No em dash.

## v2.90: TEAL token

- New token TEAL #26A699, used for the Crisis support card's icon (replaces the #2A8C82 stand-in).

## v2.89: emergency and crisis cards match the Figma screens; "Write a message…"

- Emergency: chat's message, then an "Emergency services" card: red shield icon, "For immediate medical emergencies", a full-width Call 911, and the footnote "If you're outside the US, call your local emergency number."
- Crisis: new message ("I'm glad you told me. You don't have to face this alone. Call or text 988, or text HOME to 741741…"), then one "Crisis support" card: teal icon, "Talk with a trained crisis counselor by phone or text.", Call 988 and Text 988 side by side, Text HOME to 741741 full width, and the footnote "Free crisis support, available 24/7. Standard message and data rates may apply."
- Buttons are labels only (no icons): the first is the dark blue primary, the rest gray secondaries; 44, Label medium.
- The composer's placeholder is "Write a message…". The legal line is left-aligned.

## v2.88: "Go to Community"

- The link to Community reads "Go to Community" (was "Open Community"). Links to a main section use "Go to [section]".

## v2.87: links from chat go somewhere visible; flows stack over chat

- Links to main sections (care plan, Tracker, Community): chat slides down and the app goes to that section. Chat keeps its place, so tapping Chat reopens the same conversation. Before, the section switched underneath chat, so nothing visible happened.
- The profile overlay now opens above chat (it was behind it).
- While a flow chat started is open over it (an add flow, Ask O4M, the profile), chat steps back (scaled to 94%, rounded corners) and dims (SCRIM). Closing returns to the conversation. Full-screen flows cover chat once they've slid up, so the step-back shows during the transition; bottom sheets show it the whole time.
- To try it: ask "What have others found helpful?" and tap Go to Community; or "I just started taking ondansetron" and choose Add.

## v2.86: legal line below chat's latest answer

- The legal line sits right below chat's latest answer (16 apart), not after the person's newest message. When they send, it stays under chat's previous answer until the new answer arrives, then moves under it.

## v2.85: legal line right below the latest message

- In a conversation, the legal line sits right below the latest message (16 apart), so it's always the last thing in the conversation. It's no longer pinned to the bottom while the conversation is short. Still never on the landing.

## v2.84: the legal line belongs to the conversation

- No legal line on the landing: until a conversation starts, it isn't in the context of anything.
- In a conversation, the legal line is part of the content, not docked to the composer: at the bottom of the content (16 above the composer) while the conversation is short, then pushed down by messages, always the last thing in the conversation.

## v2.83: history dates

- A conversation's date is when its last message was sent or received; opening or reading it doesn't change it. The menu's newest-first order uses the same date.
- Format, matching the day separators: "Today", "Yesterday", "Oct 22" this year, "Oct 22, 2025" in earlier years.

## v2.82: history rows: title and date

- History menu rows show the title, then the date ("Oct 22"); the message count stays removed. Two lines, so the title is Title small (14/20, semibold) and the date Paragraph xsmall (12/16), BLACK_38, 4 apart; 64 tall.

## v2.81: history rows show the title only

- History menu rows show just the conversation's title (no date or message count): one line, Paragraph small (14/20, regular, per the row text-weight rule), 12/16 padding, 44 tall.

## v2.80: prompts return only when the composer is empty and unfocused

- On the landing, the suggested prompts come back only when the composer is empty and unfocused (they used to return on unfocus even with text typed).

## v2.79: every button is a pill

- Shape rule: every button is a pill, at any width or size. Icon-only buttons are circles. Rows (prompts, answers, option cards, list rows) stay rectangles.
- Crisis and emergency buttons and the delete dialog's buttons are pills again (were rectangles in v2.76).

## v2.78: history menu opens to 74%

- The history menu opens to about 74% of the screen width (316 at 428), leaving 112 of the chat visible at the edge as the tap target to close (was 86%).

## v2.77: composer corners 28

- The composer's corners are 28: a pill at its single-line height (56), held as it grows, and concentric with the 36 send button (18 + 10 = 28). Replaces 16 (and the XL 24 proposal).

## v2.76: shape follows width

- Shape rule: a button that stretches to fill its space is a rectangle (S, 8 corners); a button sized to its label is a pill. Rows (prompts, answers, option cards) are rectangles too. Size still comes from importance (56 only for the one main bottom button; full-width buttons elsewhere are 44).
- Crisis and emergency buttons and the delete dialog's buttons (full width) are now rectangles. Links in answers (sized to their label) are now pills. "New chat" stays a pill.

## v2.75: each crisis resource is its own outlined card

- Chat answers in plain text, then each resource as its own outlined card below (white, 1 pt BLACK_12, corners M, 16 padding, 12 apart): name (Title medium), a short description (Paragraph small), then full-width 44 buttons. Each card's first action is the dark blue primary, the rest gray secondaries.
- Emergency services: "For a medical emergency, or if you're in immediate danger." Call 911.
- 988 Suicide & Crisis Lifeline: "Talk with a trained crisis counselor, free and available 24/7 in the US." Call 988, Text 988.
- Crisis Text Line: "Text with a trained crisis counselor, free and available 24/7 in the US." Text HOME to 741741.

## v2.74: crisis and emergency: outlined card, full-width buttons

- Two separate messages, same design: an outlined card (white, 1 pt BLACK_12, corners M, 16 padding), the message, then full-width 44 buttons stacked 8 apart.
- No resource names or subtitles: the labels say it all. Emergency: "Call 911". Crisis: "Call 988", "Text 988", "Text HOME to 741741". The first is the dark blue primary, the rest gray secondaries.

## v2.73: approaching-the-limit line at 14

- The approaching-the-limit line is Paragraph small (14/20), 8/16 padding, M corners, 12 above the composer (was 12.5). The limit-reached box was already 14.

## v2.72: crisis cards back to separate, without icon or heading

- Crisis and emergency responses go back to the gray box (GRAY_100) with each resource as its own white card (name, subtitle, 44 actions), as in v2.68, but without the icon and the uppercase heading ("You're not alone", "Get help now"). The stroked single card from v2.71 is gone.
- "New chat" stays the orange primary.

## v2.71: orange New chat; crisis messages are one stroked card

- "New chat" is the orange primary in the history menu and the limit notice: starting a conversation is your action, like sending.
- Crisis and emergency responses are one card with a subtle stroke (1 pt BLACK_12, corners M, 16 padding): the message, then each resource (name, subtitle, 44 actions), with a hairline between resources. No gray box and no uppercase heading.

## v2.70: delete dialog uses DARK_RED

- The delete dialog's Delete button was still #EF4444; it's now DARK_RED #B00020, like the overflow menu (found in an audit against the decisions).

## v2.69: links in answers are chat's secondary

- Links in answers ("Open Community →") are chat's secondary: gray fill (GRAY_100), dark blue label and arrow, 36, left-aligned rectangle with S corners. As plain text they read too weak. Gray keeps them clear of the light orange bubbles, and matches the crisis "Text 988" secondary.

## v2.68: chat's color rule: orange is you, dark blue is chat

- Orange belongs to the person: their message bubbles (light orange), the send button, and the answer they choose in a question box.
- Every action chat offers is dark blue (the AI pairing): primary dark blue fill with white label; secondary gray fill with dark blue label; tertiary dark blue text.
- Links in answers are chat's tertiary: dark blue text and arrow, no fill (were light orange, which looked like a bubble).
- "New chat" (limit notice and history menu) and Cancel in the delete dialog are dark blue primaries. Delete stays red.
- Crisis and emergency resources have actions: each resource card (name, subtitle) with 44 buttons, Label medium: "Call 911"; "Call 988" (primary) and "Text 988" (secondary); "Text 741741". The prototype can't call or text, so a tap shows what happens in the app. Body text is Paragraph medium (16/24), subtitles Paragraph small (14/20); no em dashes.
- Flows that open from chat into the rest of the app (Ask O4M, add medication) keep their normal orange buttons.

## v2.67: links in messages and the send button are 36

- Links in chat's answers are 36 (Label small 14/16, 10/16 padding, S corners): actions inside something else are 36. They were 44, which looked unbalanced against the send button.
- The send button is 36 (was 38), centered in the 56 composer: 10 above, below and to the right.
- Left-aligned rectangles take the size of where they sit: 44 standalone (suggested prompts), 36 inside content (links in answers). 36 extends its tap area to 44.

## v2.66: button scale 44, 36, 28, with labels matched to height

- 44: Label medium (16/20, 600), 12/16 padding. Links in answers, the delete dialog's buttons and the history menu's "New chat" (were 48; links and menu labels were 14).
- Suggested prompts: 44 with Paragraph small (14/20) and 12/16 padding: suggestions stay a step smaller than commands.
- 36: Label small (14/16, 600): the Chat button and "New chat" in the limit notice. 28: Label xsmall (12/16, 600). 36 and 28 extend their tap area to 44.
- Rows whose text is 16 (answers in the question box) stay 48: buttons follow the button scale; rows follow their text.

## v2.65: buttons on the design scale: 48, 36, 28

- Left-aligned rectangles are 48, like the question box's answers: links in answers and suggested prompts (were 44).
- Pills: dialog buttons and the history menu's "New chat" are 48 (were 42 and about 44). The Chat button is 36 (was 32). "New chat" in the limit notice stays 36.
- 36 and 28 buttons get their tap area extended to 44 in production (invisible, standard practice).

## v2.64: every question is answered by tapping an answer; no Skip

- The separate "Skip" / "Not now" link is gone. Declining is always the last answer ("Not now"), an option card like the others, so every question works the same way: tap an answer, including "no".
- "Not now" shows as the person's reply, and chat responds as before ("No problem. You can always send it later.", "If you'd like to add it later…"). In a chain of medications, it moves on to the next one.
- The questions for missing information already worked this way ("I don't know", "I'd rather not") and are unchanged.
- The chain's follow-up question no longer has an em dash ("Next, want me to add metformin?").

## v2.63: an open question can always be answered, even at the length limit

- Capturing information beats the length limit. If chat asks a question as the conversation reaches its limit, the question still shows and can be answered, and whatever it starts runs (saving, the clinical team handoff, connecting records), including follow-up questions. Before, the limit replaced the question box, so the question disappeared.
- The limit notice shows at the same time, above the question box (12 apart, one docked area). The composer stays locked: "Answer above to continue", then "Start a new chat to continue".
- Limit notice snapped: 12/16 padding, Paragraph small text, "New chat" a small pill (36), per the shape rule. The approaching-the-limit line no longer has an em dash.

## v2.62: question box spacing follows the spacing rule

Spacing rule: 4 inside one element; 8 items in a group or a caption to its field; 12 groups within one component, including the docked input area; 16 between separate components and container padding; 24 between sections and turns.
- Question box: 16 padding on every side (15 + the 1 pt border), 12 below the question, 8 between answers, 12 above Skip.
- The question box sits 12 above the composer (was 8): when it shows, it stands in for the composer, so together they're one docked input area. Prompts also sit 12 above the composer.

## v2.61: compact option card's number shows the selection

- When an answer in the question box is chosen, its number turns orange (BRAND) with a white number, the way the standard option card's radio turns orange. The card itself still shows ORANGE_25 with an orange border.

## v2.60: components render at their finished heights

Heights include the 1 pt border (like Figma's inside strokes); where a component has a border, its padding is 1 less in code so the finished height is exact.
- Chat button 32 (was 36). Composer 56 for one line, +24 per line, max 152 then scrolls (was 64; the text area also had a 4 pt inline gap).
- Suggested prompt 44 (was 40: its text wasn't on the 20 line height). Bubble 48. Question-box answer row 48. Skip / Not now 32.
- Link in an answer 44. Overflow menu row 44. History row 64. Chat header 60.

## v2.59: question box uses existing components

- Answers are the option card's compact variant: white with a BLACK_12 border at rest; when chosen, ORANGE_25 with an orange border (the option card's selected state), then it sends. One choice at a time, like onboarding. Number instead of a radio.
- Skip / Not now is the tertiary button: orange Label small, no fill or outline.
- Only the docked container is chat's own component.

## v2.58: chat snapped to design system tokens

Every chat value now maps to a token or type style:
- Colors: composer and menu borders BLACK_12; delete DARK_RED #B00020; send button (can't send) LIGHTEST_GRAY #E4E4E4.
- Shadows: overflow menu Level 2; chat sheet Level 3.
- Spacing: question box 12 padding and 12 row padding; history rows 12/16, 4 between title and date; delete dialog 16 sides; 8 between the Chat button's sparkle and label.
- Sizes: question-box numbers 24 with XS (4) corners; dialog buttons 42 (medium); dialog corners XL (24).
- Type (TypographyV2): greeting Title large (22/600); headers and dialog title Title medium (16/600); Chat button label Label small (14/600); answer options Paragraph medium (16/400); dialog buttons Label medium (16/600); source line, separators and fine print Paragraph xsmall (12/16).

## v2.57: chat type and measurements on the scale

- Question box: the question 16 semibold, answer options 16 medium, Skip / Not now 14 semibold (were 14.5 and 13.5).
- Landing's docked section: 16 side margins (was 12).
- Links in answers become the tinted secondary as a rectangle (outlined is retired): light orange fill, orange 14 semibold label and arrow, 12/16 padding, 8 corners.
- Overflow menu text 14; composer line height 1.5.

## v2.56: fix: delete and add flows opened behind the chat sheet

- The conversation's overflow menu (Delete) was layered for when chat was a tab, so it opened behind the chat sheet and couldn't be tapped. It now opens above the sheet; delete works end to end (menu, confirmation, back to the landing, gone from the history).
- The add flows started from chat (for example "Add ondansetron" when saving a medication) also opened behind the sheet. They're now lifted above chat while it's open, and return to the conversation.

## v2.55: no close button inside a conversation

- A conversation's header is back, title, new chat and overflow (⋮). The × is only on the landing, where chat is dismissed; from a conversation, go back to the landing to close.
- The conversation's title now shows in its header.

## v2.54: type sizes and suggested prompts

- Messages are 16 with 1.5 line height: your bubbles and chat's answers (were 14 and 14.5). The composer is 16 too, so a message doesn't change size when it's sent.
- Suggested prompts: 8 corners (matching rectangular buttons), 12/16 padding, 14 text.
- Source line and fine print: 12.

## v2.53: conversation spacing, bubbles and separators

- Your bubbles: ORANGE_25, dark text, 12/16 padding, 16 corners; only the last bubble in a run of your messages gets the 4 tail corner. Max 82% of the conversation column.
- Spacing: 8 between consecutive messages from the same sender, 24 when the sender changes (and above the typing indicator). 16 around the conversation.
- Answers: 12 between paragraphs; the source line 8 below; buttons and links 12 below.
- No per-message timestamps. A day separator ("Today", "Yesterday", "Oct 22") when the date changes, or above the first message of an older chat; a time separator after a pause of more than an hour. 12, BLACK_38, centered; 24 above, 16 below.

## v2.52: chat landing with a docked composer

- The sparkle and "Hi {name}, ready when you are." fill the space above and stay centered vertically.
- Docked at the bottom: the suggested prompts, then the composer, then the fine print.
- Focusing the composer hides the prompts (they've chosen to type; on a phone the keyboard slides up), and the greeting re-centers. The prompts come back when the composer loses focus.
- The composer stays flat at rest and lifts (Level 1) while focused.

## v2.51: AI buttons use dark blue with the orange sparkle

- AI has its own button pairing: dark blue with the always-orange sparkle. Primary: dark blue fill, white text. Secondary: gray fill, dark blue text. Tertiary: dark blue text.
- The Chat button is the AI secondary at header size: its label is now dark blue (#414652), sparkle orange.

## v2.50: the chat composer lifts on focus

- At rest the composer is flat: white, 1px border at 14% black, 16 corners, no shadow.
- While focused (typing), it lifts with the Level 1 elevation (the soft card shadow). No orange ring: the send button already turns orange as you type.
- Disabled (locked by a question, or at the limit) is now 38% opacity, per the state rules (was 55%).

## v2.49: Button emphasis (Apple-style) and AI as its own identity

Supersedes v2.48's neutral secondaries.
- One action color, orange; emphasis comes from the background: filled (orange, white label), tinted (light orange fill, orange label and icon), gray (header actions, orange label), plain (orange text).
- Today: "Log symptoms" (both places), "Write a note" and the symptoms edit button are tinted secondaries. "Edit note" (once a note exists) is a tertiary: orange text, no fill.
- The Chat button's label is orange, matching its sparkle.
- AI is its own identity: the sparkle is the AI mark (orange, with its working pulse); inside buttons it takes the label's color.

## v2.48: secondary buttons are neutral (Button emphasis)

- Follows the design system's decided "Button emphasis" rule: secondaries are a gray pill with dark text and dark icons. Color only comes from emphasis (primary, tertiary) or identity (the AI sparkle, always orange).
- Changed: "Log symptoms" (check-in, both places), "Write a note" / "Edit note", and the symptoms edit button now use dark text and icons instead of orange.

## v2.47: suggested prompts only lead to direct answers

- Prompts by section now come from the Question map's prompt-safe questions:
  - Today: "When's my next appointment?", "What should I watch for between scans?"
  - Care plan: "What does my diagnosis mean?", "What do the guidelines say for my stage?"
  - Tracker: "How can I manage fatigue during treatment?", "What side effects should I watch for?"
  - Community: "What have others found helpful?" (answered, with an "Open Community" link)
- Each was checked: none leads to the generic fallback, a hard stop, a crisis response or a request for information.

## v2.46: chat asks for information it needs, and holds the answer until it has it

- When a question needs records or a detail chat doesn't have, chat asks a required question above the composer (no skip), and the composer stays locked ("Answer above to continue").
  - No records: "To answer this, I need your health records. What would you like to do?" with "Connect my records", "I don't know", "I'd rather not".
  - Records connected, detail missing: "I need a detail your records don't have. What would you like to do?" with "Connect another portal", "Tell you myself", "I don't know", "I'd rather not".
- "I don't know" or "I'd rather not": "That's okay. I can't answer this one well without it, so I'll hold off. I'm happy to help with anything else." Chat doesn't answer that question; asking it again brings the question back. Chat itself is never locked.
- "Connect my records" connects (simulated) and says to ask again once they're in. "Tell you myself" invites them to type it, saved as something they told chat.
- The old "Connect your health records" button under the answer is replaced by this question.

## v2.45: chat hands off to Ask O4M, no nurse chat

There's no live nurse chat in production, only Ask O4M (a message to the clinical team, answered later), so chat now matches that.

- Hard stops, a request for a nurse or a person, and emotional difficulty end with a question above the composer: "Would you like to send this question to our clinical team?" with "Yes, send it" and "Not now".
- "Yes, send it" opens the existing Ask O4M sheet over chat, with the question filled in and editable. Chat does nothing more: it doesn't send, track or show replies. Closing or sending returns to the conversation.
- "Not now" replies: "No problem. You can always send it later."
- A request for a nurse: "There isn't a live nurse chat yet, but you can send your question to our clinical team, and they'll get back to you." (the form opens empty).
- Hard-stop copy points to the clinical team instead of "an oncology nurse right now".
- The crisis response no longer offers an in-app nurse: Ask O4M isn't immediate help. It keeps 988 and the Crisis Text Line (911 for emergencies).
- The "Chat with a nurse" box is removed. The Ask O4M sheet's own wording (reply within a day, not your doctor's office, call 911 for anything urgent) covers expectations, so chat adds none.

## v2.44 — blank-name fallback uses the relationship
If a caregiver's patient name is ever missing (it's required, so this is a safety net), copy uses the relationship they picked: "your parent", "your partner", "your child", "your sibling", "your friend". For "Other" or no relationship, it uses the "you" wording. Replaces "your loved one".

## v2.43 — caregiver copy fixes + patient copy engine hardening
From the production port review (Claude Code, `prototype/redesign-05-logic`):
- **Engine:** a caregiver's typed name is never read as copy. While tokens resolve, the name stands in as a private placeholder, swapped in at the end, so "Mom {their}" and "Mom|Dad" come through unchanged and can't loop. Unknown tokens match own keys only, so `{constructor}` / `{__proto__}` stay as written. Blank-name fallback is "your loved one" (was "the person you care for"; the name is required, so this is a safety net).
- **Copy:** question options and hints shown to caregivers from next steps now follow the patient copy rule: "It's spread to other parts of Mom's body", "We've been told it's early", "We haven't been told / we're not sure", "Mom hasn't been tested", "found by testing the tumor". Self copy unchanged.

## v2.42 — redesign-05 checkpoint
Snapshot of the redesign work as **redesign-05**, continuing the redesign-04 line. No functional changes since v2.41. Includes everything from v2.20 to v2.41: reconstructed redesign-04 source, new onboarding (front door → four plain-language questions → who's this for → patient details → account → Today), caregiver model and patient copy system (`src/services/patientCopy.js`), Ask O4M in place of chat, Today order (summary → check-in → next steps → care plan / Ask O4M → share → content), real logo. Preview path: `docs/iterations/redesign-05/index.html`.

## v2.41 — first-question note says why
Note under the first question is now: "A few quick questions to build your plan. Not sure about something? That's okay, you can add it later." — says why we're asking (the start of a plan, not a form) without bringing back a separate intro screen.

## v2.40 — patient info right after "who's this for"; note on the first question
- **New order.** Myself: questions → who's this for → **About you** (name + DOB) → Create a new account (sign-in only; choosing a method creates the account). Someone I'm caring for: questions → who's this for → **Who are you caring for** → Create a new account (sign-in) → **Now, a little about you** (caregiver's own name + DOB) → Create account. Record info comes right after the question that defines the patient; the account step is only about the account.
- `OnbAbout` has two modes: `collect` (self, before the account, "Continue") and `create` (caregiver, after sign-in, "Create account"). Account errors for self show on the sign-in step.
- **Reassurance moved onto the first question:** "Not sure about something? That's okay. You can add it later." under "What type of cancer are you dealing with?" (onboarding only, not the gap sheet). Replaces the removed "Let's build your plan" screen, which felt like a second Get started.
- Progress bar now tracks position in the actual step list.

## v2.39 — removed the "Let's build your plan" screen
Get started now goes straight to the cancer-type question; Back from it returns to the front door. Note: that screen carried the expectation-setting line ("Not sure about something? Skip it — you can always add it later."), which the rationale docs cite.

## v2.38 — "Who are you setting this up for?" is required
Removed the Skip. The answer decides whose record it is, whose name the copy uses ("you" vs "Mom"), whose date of birth goes on the record, and whether the caregiver step appears — a caregiver who skipped would have been silently set up as the patient. Everyone knows the answer, so "not sure" doesn't apply; it's a one-tap choice.

## v2.37 — account screen title
"Save your plan securely." → "Create a new account". Body copy unchanged ("Because this is your health information, you'll need an account to keep it safe and come back to it.").

## v2.35 — real logo on the front door
The front door's placeholder (icon chip + "Outcomes4Me" text) is replaced with the brand logo (mark + wordmark), `src/assets/outcomes-logo.svg`, imported `?raw` and inlined as a data URI so the single-file build carries it. Rendered 30px tall, left-aligned (v2.36: `alignSelf: 'flex-start'` — the flex column was stretching the img to full width, which centered the SVG inside it).

## v2.34 — Today order follows the daily habit
Today is now: summary → check-in → next steps → Your care plan / Ask O4M → Share your full picture → content. Same order every day.
Why (interview synthesis): the check-in is the daily job during treatment (P1, P2, P4, P18, E1) and must be fast and pay back visibly; the care plan is the most valued surface ("what comes next" — P25, E1, P2, P24; coordination P6/P23; NCCN P24; trials P22) but is opened on events (results, treatment change, a visit); the synthesis has little direct evidence for asking O4M's clinical team. Watch: check-in completion/return, and Ask O4M use from lower on the page.

## v2.33 — summary: removed "See your care plan" button
The day-one Daily summary no longer has its own "See your care plan" button — the "Your care plan" block sits directly below it. Summary text unchanged.

## v2.32 — Today pair: Your care plan + Ask O4M
Chat isn't in production, so the right-hand Today block is now **Ask O4M** — the clinical-team form (people, not AI; no sparkle). Pair off the summary: self-serve + ask a person.
- **Your care plan** · "Treatment options and history" (was "Options & full history").
- **Ask O4M** · "Questions to our clinical team" → opens `AskO4MSheet` (previously unreachable).
- **Form (strawman until the production fields are confirmed):** "Send a question to our oncology clinical team. A person reads every question and follows up, usually within a day." · optional topic (Treatment options, Side effects, Test results, Clinical trials, Something else) · question (caregiver placeholder: "What would you like to ask about Mom's care?") · note: "This goes to Outcomes4Me's clinical team, not your doctor's office. For anything urgent, call your care team or 911." · "Send to the clinical team". Fixed the old button, which said "Send to your care team" (O4M's clinical team is not the patient's care team).
- `onSend` now receives `{ topic, question }`.

## v2.31 — caregiver doesn't know the birthday
- **Patient step:** under the date field, "I don't know Mom's birthday" swaps the picker for "About how old is Mom?" (Under 40 · 40–64 · 65 and older · Not sure) with "We'll ask for the exact date if you share with the care team." "I know the date" switches back. Never blocks.
- **Record:** `patientState.ageRange` (only when the DOB isn't known); `dateOfBirth` stays empty. Not a next step — it doesn't sharpen the plan.
- **Share time:** the ask covers whatever is missing — "Add Mom's full name and date of birth" / "…full name" / "…date of birth". Name is required to share; the date can be skipped ("Share without it") and is asked again next share until added. Saved via `onSavePatientDetails`.
- **Full picture overview:** "Born Jan 1, 1961", or "Age 65 and older · exact date not added" (nothing shown for "Not sure").
- Self signup unchanged — everyone knows their own birthday.

## v2.30 — Today sun uses the summary card as its horizon
Morning no longer uses `wb_twilight` (its built-in horizon line stacked on the card read as a hamburger). All times use a bare glyph drawn behind the Daily summary card (zIndex -1 inside the card wrapper), so the card's top edge is the horizon: morning = `wb_sunny` low and half-hidden (rising, `rise: 84`), afternoon = `wb_sunny` fully up (`rise: 128`), evening = `bedtime` moon. Anchored to the card, not the page, so it stays right when the greeting grows (e.g. the caregiver "Caring for Mom" line). Greeting moved to zIndex 2 so it stays above the glyph.

## v2.29 — patient copy: one string, filled per reader (phase 1)
New `src/services/patientCopy.js` — the rule, the tokens, and `fillCopy(template, subject)`. Every sentence is written ONCE; the app fills in who it's about.
- **Rule:** ask "who is this sentence about?" About the person with cancer (body, feelings, symptoms, diagnosis, treatment, appointments, record) → tokens. About the person holding the phone (actions, settings, account, things they manage) → plain "you".
- **Tokens:** `{they}` you/Mom · `{their}` your/Mom's · `{they're}` you're/Mom is · `{they've}` you've/Mom has · `{self|caregiver}` for words that change ({are|is}, {have|has}, {your|the}). Capitalize the token to capitalize the output. Tokens nest; an empty form is allowed ("past {your |}surgery").
- **Writing rules:** name the person once per sentence (later → "the"), no he/she/they, shared things stay "your" (your care plan, your care team, your next steps).
- **Plumbing:** `PatientCopyContext` (App provides `careSubject(patientState)`), `usePatientCopy()` hook returns `t(template)`; module-level builders call `fillCopy` directly. Unit tests cover self, caregiver, "my husband", names ending in s, nesting, stray braces.
- **Converted (phase 1):** Daily summary (day one + day two), check-in (spine + card + mood sheet + daily-log line), journal prompts, next steps (all kinds incl. visit prep and trial match), onboarding/gap questions + options, full picture title/share title, Today share card. Self copy is unchanged; caregivers now read "How is Mom feeling today?", "Add Mom's stage to sharpen your plan", "Mom is dealing with breast cancer…".
- Removed the one-off caregiver branches in the summaries; the earlier summary voice rule is now the general system.
- **Phase 2 (not yet):** remaining ~200 strings — care plan / timeline, symptom & medication flows, treatment details, community, resources, profile, plus clinical content in `src/data/`.

## v2.28 — caregiver: patient info together, account info is yours
- **"Who are you caring for?"** now holds everything about the patient: what you call them, relationship, and **their date of birth** (label follows the typed name — "Mom's date of birth"). Continue needs all three.
- **"Now, a little about you."** — "This is just for your account — you've already told us about Mom." Your first name, last name, **your** date of birth. Account info is entirely the person setting it up.
- Record DOB = the patient's (from the patient step for caregivers; the account holder's own for self). Account DOB = the caregiver's own. `createOnboardingAccount` requires a birthdate again.

## v2.27 — summary voice rule: facts name the patient
The UI talks TO the person holding the phone; the summary states facts ABOUT the patient. For caregivers, the Daily summary's factual sentences (diagnosis, treatment, surgery, appointments, record) name the patient as typed — "Mom was recently diagnosed with kidney cancer…", "Based on everything in your husband's record…", "Logging how Mom is feeling and noting your questions now will help you both prepare for it." Operator-directed parts stay "you/your" ("your care plan", "your next steps", "your care team"). Everything outside the summary is unchanged (v2.26 one voice + anchor).

## v2.26 — one voice: "you/your" app-wide + caregiver anchor
Reverses the name-in-copy from v2.24–2.25. Personalizing every string for caregivers would mean two versions of ~250 strings (incl. clinical content) and every future screen; partial personalization made the rest of the app feel mismatched.
- **All app copy is "you/your" for everyone** again: summary (day one and day two), check-in prompts, journal prompts, mood sheet, next-step gaps, gap-sheet questions, full picture.
- **Anchor:** caregivers see "♥ Caring for Mom" under the Today greeting — says whose record this is, so "your care plan" reads as shared.
- **Kept:** the caregiver onboarding step (what you call them + relationship), "A little about you both" (your name on the account, the patient's DOB on the record), the share-time full-name ask ("Add Mom's full name"), and the relationship-matched content sample (1 of 2 webinars, 1 of 2 community posts).
- Removed (not just disabled): caregiver journal prompts, `_gapTitle`, question `titleFor`, subject props on MoodFlow / CheckInSpine / AnswerQuestionSheet.

## v2.25 — caregiver: typed name drives copy, relationship drives content
- **Name = copy.** "Who are you caring for?" asks "What do you call them?" (e.g. Mom, or their first name). Whatever they type is used as-is everywhere ("How is Mom feeling today?"); "mom" → "Mom", "my husband" → "your husband".
- **Relationship = content.** Neutral list: Parent, Spouse or partner, Child, Sibling, Friend, Other. No wording depends on it.
- **No pronouns in caregiver copy** (the typed name doesn't tell us one): "Mom's care team", "the care plan", "Checking in on Mom below…".
- **Caregiver content sample** (`CAREGIVER_CONTENT`): 1 of 2 webinars and 1 of 2 community posts swap for relationship-matched ones (e.g. Parent → "Caring for a parent with cancer" + "How do you keep track of a parent's appointments and meds?"). News band (incl. sponsored slot) unchanged.
- **Day-two summary** is now subject-aware too ("Based on everything in Mom's record…", "Logging how Mom is feeling and noting your questions now will help you both prepare for it.").
- **Full picture**: titled "Mom's full picture"; Today card "Share Mom's full picture". First caregiver share asks once for the patient's full name ("Add Mom's full name — the care team will need it to match this to the right person"), saved as `patientState.patientFullName` and included with DOB in the shared text. Self shares use the account name.

## v2.24 — caregiver: who you're caring for
If "Who are you setting this up for?" = **Someone I'm caring for**, onboarding adds **"Who are you caring for?"** — their first name + relationship (Mom, Dad, Wife, Husband, Partner, Daughter, Son, Sister, Brother, Friend, Someone else). The record, check-in and summary are about the patient; the caregiver logs on their behalf (interview finding).
- `careSubject(ps)` + `RELATIONSHIPS`: one place that decides how the patient is referred to. Family → "your mom" / "her"; Partner, Friend, Someone else → first name / "their". Self → "you".
- Uses it: first-run summary ("Your mom was recently diagnosed with… Checking in on your mom below keeps this up to date"), check-in prompts ("How is your mom feeling today?", "Is your mom having any symptoms today?"), caregiver journal prompts (rotating, about the patient), mood sheet title, next-step gap titles ("Add your mom's stage to sharpen her plan"), and gap-sheet question titles ("Where is your mom right now?").
- **"About you" for caregivers → "A little about you both."**: your first + last name (account), and **the patient's** date of birth (record only — the caregiver's account carries no birthdate). Self is unchanged.
- Record: `patientState.patientName`, `patientState.relationship` (stored as answers `patient_name` / `relationship`, so every rebuild keeps them).
- Onboarding steps are now computed from the answers (`onbSteps`), so the caregiver step appears/disappears correctly when stepping back and changing the role.

## v2.23 — first-run summary reads as a summary
The day-one Daily summary is no longer a separate welcome message; it's the same card (same layout, AI footer, feedback) doing what it does every day — pulling the situation together and pointing to what's next — built from the onboarding answers (`buildWelcomeSummaryText`). Structure: light welcome opener ("Welcome — here's where things stand.") → situation (type + where it is + treatment phase, e.g. "You were recently diagnosed with kidney cancer that's in one place, and treatment hasn't started yet.") → what the care plan holds or what will fill it in (most important gap) → "Checking in below keeps this up to date, day to day." → "See your care plan". Re-renders live as gaps are answered. Caregiver copy uses they/their. Normal summary from day two.

## v2.22 — onboarding: name + date of birth at account creation
Account creation is now two steps: **sign-in method** ("Save your plan securely." — email + password, Apple, or Google) → **"A little about you."** (first name, last name, date of birth; "Your name and date of birth keep your health information matched to you.") → Create account → Today. Back from "About you" returns to sign-in with the chosen method kept; details are kept if you step back.
- `authService`: `createOnboardingAccount` now takes `firstName`, `lastName`, `birthDate` (all required) and stores `name` + `birthDate` on the user; new `checkEmailAvailable` validates email on step 1 so a duplicate is caught before "About you".
- Date of birth is also written to the record as `patientState.dateOfBirth`. `recordFacts(ps)` carries `onboardedDate` + `dateOfBirth` through every patient-state rebuild (gap answers and ClinicalEditSheet) — previously ClinicalEditSheet's rebuild dropped `onboardedDate`.
- `IosPickerSheet` / `DateInputField` gained optional `yearRange`, `defaultValue`, `hint`, `placeholder` props (existing callers unchanged). The birthdate picker spans the last 110 years and opens 50 years back.
- Greeting now uses the first name ("Good evening, Dana.").

## v2.21 — redesign-04: new onboarding
Replaces the early-iteration onboarding with the locked redesign-04 flow: **front door** (AuthScreen landing: "Understand your cancer, build a plan, and walk into your appointments prepared." + Get started; quiet "Already have an account? Sign in") → **promise** ("Let's build your plan.") → **4 plain-language questions** (cancer type with search + 5 featured + "I'm not sure of the exact type"; where it is; where you are in treatment; who it's for, optional with Skip) → **create account** ("Save your plan securely." — email / Apple / Google; Apple/Google simulated) → **Today**, already populated.
- **First-run welcome summary** (`buildSummaryNarrative` → `welcome` variant on `patientState.onboardedDate === today`): capable/calm lead + orient line + "See your care plan". Normal summary from day two. Caregiver label switches copy to "Their plan's started…".
- **Gaps as one-tap next steps** (`deriveQuestionGaps`, derived from `onboardingAnswers` — one source of truth): "Add your cancer type to start your plan", "Add your stage to sharpen your plan", "Tell us what's driving your cancer", "Tell us where you are in treatment". Each opens `AnswerQuestionSheet` on exactly that question; answering rebuilds the patient state and closes the gap everywhere. "Not sure" leaves it open.
- **Shared primitives:** `ONB_QUESTIONS` + `OnbQuestion` + `OnbCancerType` are used by both onboarding and the gap sheet (and the diagnosis card's Edit for new-model records), so the question wording lives in one place.
- **Wiring fixes found in the audit:** (1) reload check — a new user's record has 1 event, fewer than the demo seed's 6, so the old event-count heuristic sent them back to onboarding on reload; now `onboardedDate` marks onboarding complete. (2) "Not sure" of stage used to silently become Stage I; stage is now `null` when unknown (no fabricated recommendations) and plants the stage gap. (3) No fabricated diagnosis date or surgery/pathology events — the diagnosis is placed on the day it was added. (4) Removed the orphaned onboarding medication-add wiring (`onboardingMedFlow`). (5) Greeting drops the name when none was given ("Good evening."). (6) Today's news band reads "New for you" when the cancer type isn't known yet.
- **Answer model:** `cancer_type`, `extent`, `treatment_phase`, `role`, `drivers` (strawman). `extent` maps to the engine's stage (one place/early → I, nodes → III, spread → IV). Legacy keys (`stage`, `histology`, `treatment_status`) still honoured by `buildPatientStateFromAnswers` and `ClinicalEditSheet` for older records.
- New in `authService.js`: `createOnboardingAccount({ provider, email, password })`.

## v2.20 — redesign-04: source reconstructed (post-v2.19 changes replayed)
The build container reset had wiped the editable source after v2.19; only the build (`index-redesign04.html`) survived. This commit restores the source by replaying every post-v2.19 change, verified against that build: all 5,138 app strings match, the 4 inlined images are byte-identical, and the structural similarity ratio is 0.998 (remaining differences are code placement only). Restored: recency-led Today bands (`todayBands(cancer)`: New in [cancer] + Sponsored, Expert webinars, From the community) with 2-up media/text `ContentBand` and See-all routing; real inlined images (now in `src/data/todayImages.js`); "Share your full picture" (`CareSummarySheet` + standing Today card); liquid-glass floating footer; per-tab glass header (transparent on Today, translucent + collapse-on-scroll elsewhere via `onScrollCapture`); 60px timeline spacer for sticky day headers; time-of-day atmosphere glyph (`_TOD` / `_todInfo(override)`); Profile dev toggle "Time of day (atmosphere)" (persisted `o4m_dev_tod`); bottom/top clearance on scroll regions. Small cleanup vs. the build: the summary sheet's helper components and glass-chip style are hoisted out of render. Known carry-over: the header Back/Chats-menu buttons have no background/border reset, so browser-default button chrome may show on drill-ins.

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

## Redesign 01 — "payoffs" (the record gives back)
_Version 2.18 · redesign-01-payoffs · base: v2.17 (last commit on GitHub main)._
First structural redesign pass, additive into the existing Today `DaySection`, Track, and Resources — same tokens/card/flow language, nothing refactored, nothing deleted, no fabricated seed data.

**Today (careplan) now assembles, in order:** daily summary → prepare-for-visit card (only when a future appointment exists) → rule-derived action items → pending cards → the day's logged events → suggested options. A labeled, visually distinct **Sponsored** slot renders adjacent to Today, outside any date group.

- **Action items** (`deriveActionItems`, deterministic — no model dependency): (1) a pending item past its ageing window, or any saved trial, surfaces a nudge with its stated reason ("Requested 21 days ago"); (2) a medication started ≥3 days ago with nothing logged since prompts a symptom check-in. Each card has a stated reason, a primary action, and dismiss; resolving the underlying item removes it. Quiet "all caught up" empty state when none.
- **Pending shape** (records / genomic / genetic / trial): visible on Today until resolved; on resolve, drops a normal `pending-resolved` entry onto the timeline at the resolution date. Created via a lightweight "Track something you're waiting on" writer (kind + label + requested date, backdatable).
- **Appointment artifact** (`AppointmentArtifactSheet`): a generic, editable visit summary over the interval since the last visit — symptom episodes (grouped by adjacent-day runs, peak severity), medication adherence with skips + reasons, editable saved questions, and open pending items. Rows are removable before sharing; "Share with care team" uses native share.
- **Track writers** (all write to the record): real **symptom logger** (replaces the "coming soon" stub — symptom, severity, backdatable date, notes), **skip/take dose logging** ("Log a dose" in Medications — taken/skipped + reason + date; skipped doses appear on the timeline, all doses feed adherence), and a thin **journal** writer. New **Journal** segment added to Track.
- **Resources** populated per the production audit into a content-library screen (Dictionary / FAQs / Webinars / News); name kept as "Resources", "Tracker" kept.
- **Persistence**: new additive localStorage keys (symptoms, doseLogs, journal, pending, questions, aiDismissed) with save/load, wired into the existing clear-on-reset/logout. Schema version unchanged (existing shapes untouched).

Frozen this pass: timeline sort/structure, scroll-to-Today pill, suggested option blocks, daily-summary content/logic, nav names, Chat tab, onboarding.

### redesign-01-payoffs — fix1: Today disappears after a date rollover
`isToday` was baked into persisted/initial timeline state and never reconciled to the real date on load. State saved on an earlier day kept `isToday` on a stale date, so on reload there was no node for the actual today — and since the summary, recommendations, prepare-for-visit, action items, and the scroll-to-Today target all key off the `isToday` node, Today effectively vanished (you'd see only a future day like an added appointment). Added `reconcileToday(timeline)`: on initial hydrate and on returning-user rehydrate it recomputes `isToday` against `localDateStr()` and injects an empty Today node if none exists. Purely corrective; no change to sort, structure, or the frozen daily-summary logic.

## Redesign 02 — "check-in + to-dos" (Today's imperative layer, split by horizon)
Splits production's catch-all "recommended next steps" into two audit-grounded surfaces on Today, by time horizon. Additive; daily summary and timeline structure untouched.

**Check-in** — the daily, recurring habit. A hub card with three independent lines that launch the *existing* trackers (a launchpad, not new capture, addressing the audit finding that these tools exist but are buried):
- **Mood** (core) — tap → mood capture; placeholder flow in the FlowShell scaffold (prototype only had a chat stub), but it writes a real dated mood entry so the loop is genuine.
- **Symptoms** (prompted) — "Any symptoms today?" · **Yes** launches the pass-1 symptom logger, **No** writes a dated "none" marker. Either path checks off.
- **Journal** (optional, no out) — checks off only when an entry exists for today.
- A line is "checked" whenever a qualifying entry exists **for today**, so completion reflects the record (undo the entry → check clears) and the day-roll reset is automatic (new day = no entries yet). Checked = muted-but-visible; re-openable. A subtle check-pop animation (`o4mCheckPop`) fires on completion.

**To-dos** — one-time, consequential steps that persist until done. Folds pass-1's action items, pending items (records/genomic/genetic/trial), and the prepare-for-visit card into one imperative surface (`deriveTodos` + `TodoItem`). Prepare-for-visit auto-expires when the appointment passes; pending items resolve via their action. Dropped the pass-1 "log a symptom since starting X" rule (that intent now lives in the check-in) and the synthetic "Resolved: X" timeline entry (the item itself is the record).

**Other:** the manual "Track something you're waiting on" writer moved off Today into Profile → Experiments as a labeled testing trigger (stand-in until real upstream actions fire). New persistence keys `mood`, `symptomNone` (additive). Pass-1 components (ActionItemCard/PendingCard/PrepareVisitCard/deriveActionItems) left defined but unused. Highlights/trend layer still deferred to its own pass; the check-in feeds it.

### redesign-02 — fix1: reopenable check-ins + labeled to-dos section
Two refinements from live review. (1) **Check-in rows are reopenable again** — I'd gated their tap handlers on "not done," which made completed rows inert; now all three stay tappable when checked (mood reopens to change it, symptoms reopens the logger to add another, journal reopens to add/edit), consistent with "check reflects the record." (2) **To-dos now render as a labeled section** — a "To-dos" header (with a count) above the cards, and a visible "Nothing needs doing today." empty-state card, so the surface is legible whether or not it has items (previously unlabeled loose cards + a bare "all caught up" line that read as missing). The whole section is one timeline block so it carries a single connector.

### redesign-02 — fix2: "Recommended next steps" naming + inline cards; treatment eyebrow → "Suggested treatments"
Reclaimed production's "recommended next steps" concept and resolved a naming collision. (1) Today's imperative surface is now **Recommended next steps** rendered as **inline cards on the spine** (not a boxed/labeled section) — each card carries a shared "Recommended next step" eyebrow as its signature, with a quiet eyebrow-carrying empty state when there are none. (2) The **SuggestedBlock eyebrow** in the treatment-plan parent changed from "Recommended Next Steps" → **"Suggested treatments"** (both generating and loaded states) plus its generation copy ("Generating suggested treatments…"), removing the collision with the Today surface. Today order confirmed: daily summary → system nudge (connect/records-not-synced, unchanged) → check-in → recommended next steps → logged/options. Connect-records stays a standalone system nudge, deliberately not folded into next steps.

### redesign-02 — fix3: check-ins persist to the timeline as a derived "Daily log" (single source of truth)
Check-in entries now live on their day forever, without echo/duplication. (1) **Dropped the echo writes** — logging mood/symptom/journal no longer creates standalone timeline events. (2) **Past days render a derived, read-only "Daily log" card** (`DailyLogGroup`) built *from the stores* filtered to that date (mood + symptoms + journal, plus a "No symptoms reported" line when a none-marker exists) — hub-style layout so it reads as the same family, but no check circles, no prompts, muted, neutral "Daily log" eyebrow, so a past record never reads as the interactive Today hub. (3) Because it's derived, the **stores are the single source of truth**: editing/deleting an entry in Track (once those flows exist) will update the timeline automatically, and changing an entry's date moves it to the right day — no sync code, no drift. (4) **Days with only check-in entries now appear** on the timeline (augmented render), so a day you only logged mood/journal on still exists. Today keeps the live check-in hub; the hub represents today's entries (no duplicate Daily-log card on today). Meds intentionally excluded from the check-in (cadence obligation → a future next-step once a schedule exists). Mood still has no Track management surface yet (placeholder), so a logged mood shows in the Daily log but isn't editable until the real tracker lands.

### redesign-02 — fix4: day-rollover simulator (dev tool)
Added a dev affordance in Profile → Experiments → Testing triggers to simulate the calendar advancing, so the check-in → Daily-log rollover is testable without waiting for real midnight. `localDateStr()` now applies a persisted dev day-offset (`o4m_dev_day_offset`) when computing "today" (explicit dates passed in are unaffected). "Advance a day" increments the offset and reloads; "Reset to real date" clears it. Because every date-dependent path reads `localDateStr()`, advancing exercises the whole rollover faithfully: today's logged check-in entries become the prior day's derived read-only "Daily log" card (one grouped card listing mood, each symptom + severity, and the journal text — read together), the hub resets fresh for the new today, and relative date headers/countdowns update. Confirms the intended behavior: completing check-ins yields a single grouped Daily-log card per day; partial completion shows just what was logged.

### redesign-02 — fix5: stay logged in across reloads (session → localStorage)
The session was stored in sessionStorage, which a reload inside the artifact iframe (including the new "Advance a day" dev reload) can drop — bouncing the user to sign-in each time while their care data (localStorage) stayed intact. Moved the session to localStorage in authService (loadSession/saveSession/clearSession), so login survives reloads. Fixes the day-rollover test loop (log → advance → still signed in) and the general re-sign-in annoyance. logout() still clears it.

### redesign-02 — fix6: check-in copy + gentle accumulation count
Copy under "Today's check-in" now reads "A minute a day builds your daily log, revealing patterns you'd otherwise miss." (names the daily log, frames the habit + trend payoff, tighter). Added a gentle cumulative count badge in the card header — distinct days with any check-in activity (mood/symptom/journal/none), shown as "N check-ins" with an event_available glyph, only when N>0. Deliberately accumulation, not a streak: it never resets and carries no loss/pressure framing, avoiding the guilt trap of punishing someone for a hard week. Threaded checkinCount App→DaySection→CheckInCard.

### redesign-02 — fix7: new account inherited the connect-records nudge state
Creating a new account (and logging out) called clearPersistedState(), which wipes the care-data keys but not the connect-records nudge state (o4m_engagement_v1) or the records-connected flag. So if a prior session had dismissed the nudge — which sets cardActive:true — a brand-new account inherited it and the "records not synced" card appeared immediately, before the new user had done anything to earn it. Added clearEngagementState() (removes ENGAGEMENT_KEY + RECORDS_CONNECTED_KEY) and call it in handleNewUser and handleLogout, alongside resetting recordsCardVisible/recordsConnected to false and the once-per-session ref. A fresh account now starts with the nudge inactive; the records card only appears after the intended engagement gating (2 signals → nudge → dismiss-without-connecting).

### redesign-02 — fix8: "Get started" did nothing (regression from fix7)
fix7 added setRecordsConnected(false) to handleNewUser and handleLogout, but that state setter lives in a different component, not the App scope — so clicking "Get started" threw ReferenceError: setRecordsConnected is not defined, aborting the handler before setAuthVisible(false) and leaving the user on the faded splash (sign-in was unaffected). Removed both calls; they were also redundant since clearEngagementState() already clears the records-connected flag (RECORDS_CONNECTED_KEY). Verified headless (jsdom): the Get started click now throws nothing and renders the onboarding role step.

### redesign-02 — fix9: next steps become process-starters with a state machine
Recommended next steps now move through todo → awaiting → resolved instead of a manual "mark done" tap, resolving from the most authoritative source (per the resolution hierarchy). Additive; stays in the Recommended next steps section (option a).
- New `NEXT_STEP_KINDS` config (records/genomic/genetic/trial): action-framed title, rationale, start label, awaiting status, and resolution mode ('signal' vs 'confirm').
- Pending store migrated to a `state` machine ({state, startedDate, resolvedDate, outcome}); `_normalizePending` maps the old {status:'open'|'resolved'}. `deriveTodos` shows todo + awaiting, hides resolved.
- `TodoItem` renders by state: todo = rationale + Start action; awaiting = in-motion (spinner + status line, `o4mSpin` keyframe), with a "Mark done" button only for confirm-kinds.
- Resolution split: records/genomic auto-resolve via an on-load signal (awaiting ≥1 day → resolved; the dev day-rollover stands in for records syncing / results arriving, with a toast). genetic/trial resolve via `ConfirmOutcomeSheet` — a bottom sheet capturing an optional outcome note (not a bare checkmark), since they're unobservable.
- Dev "Track a pending item" now drops a next step in `todo` state so the full arc is testable: Start → awaiting → (Advance a day for records/genomic, or Mark done for genetic/trial) → leaves the list.
- Removed the manual "Mark received / Mark as raised" resolve taps. Notification/bell layer + rich tappable "arrival" surface deferred to redesign-03 (resolves in place with a toast for now). pass-1 `deriveActionItems` remains defined but unused (dead).

### redesign-02 — fix10: pull back orange to accent/action only
Orange (C.primary) had crept in as decoration across the redesign surfaces. Neutralized the structural/state uses so orange is reserved for primary actions and small accents: check-in completion checks now fill neutral (textSecondary) instead of orange; next-step icon badges (todo/awaiting/prepare-visit) are neutral (bgApp/textSecondary) instead of primaryLight/primary; the awaiting spinner tip is neutral. Kept orange only where it earns it — the small "Recommended next step" eyebrow accent, secondary-button text (system pattern), and the one solid-orange primary CTA (prepare-for-visit "Prepare"). In-flow selection states (mood/severity chips) left as-is since they match the app's existing selection pattern.

### redesign-02 — fix11: group recommended next steps into one card
Reversed the earlier "individual cards" (option a) after seeing it — the "Recommended next step" eyebrow repeated on every card and the surface was asymmetric with the single check-in card. Next steps now render as one grouped "Recommended next steps" card (title matching "Today's check-in"), each step a divided row inside it (NextStepsCard + NextStepRowContent), with one section header instead of N eyebrows and the empty state living inside the card. Same primitive as the daily-summary/check-in cards (a titled card on the spine), not a dashboard. Per-item TodoItem retained but unused.

### redesign-02 — fix12: new account still showed a stale awaiting next step
handleNewUser/handleLogout cleared persisted storage but didn't reset the in-memory redesign stores, so a leftover pending item (e.g., an "Awaiting results" next step) survived in React state into the new account. Added setPending/setMood/setSymptoms/setDoseLogs/setJournal/setSymptomNone/setQuestions/setAiDismissed([]) resets to both handlers. A new account now starts truly blank.

### redesign-02 — fix13: next steps as a section title + individual cards (not a container)
Per feedback, moved from the single contained card back to a labeled section: the "Recommended next steps" title sits on the app background (lower surface) with each step rendered as its own card beneath it (NextStepsSection reusing NextStepRowContent). The section title carries the label once, so the individual cards drop the repeated eyebrow — resolving the repetition without a container. Rendered as one timeline block (single connector). Empty state is a single quiet card under the title. NextStepsCard (contained version) retained but unused.

### redesign-02 — fix14: hide next-steps section when empty
No reason to tell someone they have no recommended next steps. The section (title + cards) now renders only when there's at least one step; when empty it's hidden entirely. (The in-section empty state is now unreachable but left as a harmless fallback.)

---
**Branch checkpoint:** the state above is committed as design branch `redesign-02-checkin-todos` (v2.18, base v2.17 on main). The next redesign — connecting check-in ↔ daily summary ↔ recommended next steps into one loop (summary as the teaser/gateway) — will be built as a separate branch off this one, so both can be tested side by side.

## Redesign 03 — "the loop" (branch off redesign-02)
Evolves the daily summary from status-only into the teaser/gateway that ties the loop together (contribute → synthesize → act): the check-in feeds it, the recommended next steps flow from it. Additive on top of redesign-02; the status bullets/change-marking machinery is untouched.
- **`buildTeasers`** ranks candidates and surfaces the top 1–2 as tappable rows under the status bullets: symptom-frequency trend and mood trend (insights, deterministic over logged data, each with an inline **Sparkline**), "ready to share" (upcoming visit + interval data → drills into the real visit export), a treatment "option" (when recs exist), and an "arrival" (a next step resolved via signal in the last 2 days). Ranked by a novelty/urgency/actionability score; top 2 shown. Freshness/shown-recently rotation not yet persisted (noted).
- Each teaser shows its **takeaway inline** with a stated basis (connective language pointing up to the check-in) and drills in: ready-to-share → the AppointmentArtifactSheet; the rest → **TeaserDetailSheet**, a placeholder detail (larger bar view for trends) standing in for the full trends/insights view (a later pass).
- Wired App → DaySection → DailySummaryCard (teasers on today only). New overlay `teaserDetail`.
- Deferred: real trends view, freshness rotation, notification/bell layer.

**Branch:** intended as `redesign-03-loop`, built off `redesign-02-checkin-todos`. Compiled build duplicated at docs/redesign-03/index.html for a /redesign-03/ Pages URL alongside redesign-02.

### redesign-03 — fix1: prose-led summary (the guideline pathway, in plain language)
Reframed the daily summary from a bulleted status list to a plain-language narrative — the AI's read of the pathway: where you are → the guideline-mapped next step (NCCN-style, via the recommendation engine) → how to prepare (understand/take/prepare for the next step, whether appointment, procedure, or decision). New buildSummaryNarrative() templates deterministically from real record fields (surgery/results, next appointment, whether the engine has next-step recommendations), following the plain-language standard (no procedure names in the summary; points to "Suggested treatments" for specifics). Dropped the forced "a treatment option matches your plan" teaser — the next step now lives in the prose. Trends + "ready to share" remain as supporting teaser lines beneath the narrative. Thin/early state leads with an enrichment narrative + "Add an event," framing the platform's tracking inputs as what makes the output richer. The old bulleted status + change-marking render is retired on today (machinery left dormant).

---
**Branch checkpoint:** the state above is committed as design branch `redesign-03-loop` (v2.18, base `redesign-02-checkin-todos`). It's the documented base for the next direction — **redesign-04: "Today" as its own edited daily surface** (greeting → essential/check-in → AI summary → outward content → opportunities), with the timeline and NCCN treatment options becoming destinations reached from Today rather than the container it lives in. redesign-04 will branch off this.

## Redesign 04 — "Today" as its own surface (slice 1, branch off redesign-03)
Home is no longer the top of the timeline scroll — it's a dedicated, curated daily surface (an edited front page, deliberately finite, not a catch-all). The timeline becomes a destination reached from Today.
- New TodayScreen: a fixed stack of zones — greeting ("Good morning, {name}" + date) → essential daily check-in → AI "your read" (the prose summary + teasers) → recommended next steps (hidden when empty) → "You're not alone" community content (placeholder) → "New for you" trials/opportunities (placeholder) → "Your record" doorway into the full timeline. Reuses CheckInCard, DailySummaryCard, NextStepsSection from 02/03.
- Careplan tab now toggles homeView: 'today' (default) shows TodayScreen; 'timeline' shows the existing timeline scroll behind a "‹ Today" back bar. Scroll-to-today pill gated to the timeline view.
- Editorial rule: a zone shows only when it has something for the day (next-steps already self-hide). Content & Opportunities are honest first-slice placeholders styled as real cards (community story, trial match).
- Deferred (later slices): real content/community curation, real trials matching, treatment options as their own destination, and the ranking/curation logic for what earns a Today slot.
Compiled build duplicated at docs/redesign-04/index.html for a /redesign-04/ Pages URL.

### redesign-04 — fix1: zen pass on Today (softer, calmer feel)
Reworked Today from a rigid card grid to a calmer, mental-health-app feel: soft floating cards (SOFT_CARD — subtle shadow instead of hard borders, rounder 18px corners) applied to the check-in, summary, next-steps, and Today's own cards; a soft warm background wash (gradient); an airier two-line greeting with more breathing room; gentler sentence-case section labels (dropped the loud uppercase); and more space between zones. The soft-card treatment carries through the shared cards for coherence.

### redesign-04 — fix2: varied texture (spine check-in + content grids)
Broke the "everything in a card" rigidity. (1) Check-in is now card-less — three nodes on a connecting spine (mood/symptoms/journal), any order, the node lights on completion, tying it to the app's rail DNA without being the timeline. (2) Content is three benefit-named bands — "You're not alone" (community), "Learn as you go" (articles), "Worth exploring" (trials/new; renamed off "Reasons for hope") — each a section header (name left / See more right) + a 2-up grid of soft cards with gradient thumbnails. Bands render only when they have ≥2 items. Kept summary + next steps as cards (discrete objects), greeting bare, record doorway. Placeholder content for now; See more routes to Community.

### redesign-04 — fix3: sponsored label on content cards
Added a small "Sponsored" label (top-left, subtle) to content grid items flagged `sponsored`, applied to the "Newer treatment options" card in the "Worth exploring" band — a location for sponsored hubs/placements. Data-driven via an item flag so any content card can carry it.

### redesign-04 — fix4: summary before check-in
Reordered Today so the daily summary leads and the check-in follows (understand → contribute → act → explore). The summary is re-derived live on each render, so a check-in made below updates it in the same session — order doesn't affect freshness; it's purely reading rhythm. (If check-in completion ever looks weak, flip them back to give the habit top billing.)

### redesign-04 — fix5: summary as the gateway into the product's core
Made the daily summary the front door to the two things that are the actual product — the guideline-derived treatment options and the record/timeline that keeps them current. The summary card now carries doorways at its foot (Today only): "View your treatment options" (shown when the engine has recommendations) and "View your full record," both opening the timeline destination. Retired the standalone "Your record" doorway zone (folded into the summary). This reconnects the summary to the original product (guidelines exposed) rather than leaving treatment options and the timeline as orphaned destinations. Doorways render only when handlers are passed (Today), not in the timeline's own summary. (Treatment-options currently lands on the timeline where the NCCN blocks live; a scroll-to/highlight or dedicated options view is a refinement.)

### redesign-04 — fix6: treatment options as its own weighted card below the summary
Moved the guideline output out of the summary footer into its own card — it's the original product, so it earns real presence, not a link row. Below the summary: a TreatmentOptionsCard ("Based on NCCN guidelines" eyebrow → "Your treatment options" → guideline-derived blurb → "Review options →"), shown only when the engine has recommendations. The record returns as a quiet doorway at the bottom of Today ("View your full record"). Removed the in-summary doorway rows. Summary narrates; destinations stand on their own beneath it, weighted by importance (treatment options prominent, record light).

### redesign-04 — fix7: two side-by-side CTAs off the summary (options + Ask O4M)
Replaced the single treatment-options card with two equal CTAs below the summary: "Treatment options" (guideline-based → the options destination; shown only when recs exist) and "Ask O4M" (→ a placeholder AskO4MSheet that stands in for production's send-to-clinical-team form: a question textarea + send → confirmation toast). Pairs self-serve guideline output with human help as the two primary next actions off the summary. CTA icon badges use primaryLight/primary since these are genuine primary actions. When no treatments exist, Ask O4M spans full width. TreatmentOptionsCard retained but unused.

### redesign-04 — fix8: explore framing + timeline is the full record (incl today)
(1) Treatment CTA reframed to "Explore treatments" / "Your guideline-based options" — discovery, not a verdict. (2) The timeline is now the complete medical record: the derived Daily log (mood/symptoms/journal) renders on every day including today, and the interactive check-in/next-steps were removed from the timeline's today (they live on the Today surface). So everything logged — daily log, mood, appointments, clinical events, suggested treatments — has a card on the timeline as historical context. `dl` computed for all days.

### redesign-04 — fix9: Today fades to white, not gray
Changed the Today background gradient to settle into white (#ffffff) at the bottom instead of the app gray — warmer, cleaner. Cards (white, soft-shadowed) now separate by shadow against white, which reads calmer.

### redesign-04 — fix10: suggested treatments show their provenance
Turned the generic "recommended based on your diagnosis" line into named provenance: "Built from your diagnosis · your surgery · your test results · your current medications" (buildTreatmentBasis derives the contributing record facts from the timeline/patientState), plus a living-plan line "Add more to your record and these sharpen." This makes the connection between the record and the guideline output explicit (rather than implied by adjacency), and frames the plan as getting smarter with each timeline event — the core of the timeline↔recommendations loop. Threaded App→DaySection→SuggestedBlock. (Making each basis item tappable-to-trace back to its event on the spine is the next refinement.)

### redesign-04 — fix11: unify treatments + record into one care-plan entry
Treatments (forward) and the record (backward) are the same care-plan spine, so the separate "Explore treatments" CTA and "View your full record" doorway were redundant. Merged into a single "Your care plan" CTA ("Options & full history") paired with "Ask O4M" — it opens the spine at today (treatment options forward, record back). Removed the standalone record doorway. The care plan is now always available (not gated on treatments existing), so record access no longer depends on having recommendations.

### redesign-04 — fix12: remove daily summary from the care plan
The daily summary lives on the Today surface only; removed its render from the care-plan/timeline (DaySection). The timeline is now purely the record — daily logs, events, appointments, suggested treatments — with no summary card duplicated there.

### redesign-04 — fix13: care plan anchors to today on open
Opening the care plan (view → timeline) now anchors to today, the same as the timeline's own scroll-to-today — the off-screen scroll container had no layout to anchor against while hidden, so it opened at the top. Added an effect that, on switching to the timeline view, scrolls today's day strip flush to the top (instant). (Effect placed after timelineWithRecs to avoid a TDZ.)

### redesign-04 — fix14: care plan promoted to primary navigation; Home → Today
The care plan (past · present · future) is now its own bottom-nav tab, and Home is renamed Today. NAV_TABS: Today (icon today) · Care plan (icon route) · Tracker · Chat · Community. The careplan tab container now shows for both tabs and renders TodayScreen when activeTab==='careplan' and the timeline scroll when activeTab==='plan'; removed the homeView toggle and the in-view back bar (the nav handles switching). The "Your care plan" CTA and treatment/record links now switchTab('plan'). Anchor-to-today, the scroll-to-today pill, the day-label strip, and the add-event FAB all key on the 'plan' tab. Header titles updated (Today / Care plan).

### redesign-04 — fix15: eligible clinical-trial match as a ranked next step
An eligible trial match is a next step, not a standalone Today zone — so it competes for a slot and respects the "don't overwhelm" rule. Added a 'trial-match' kind (PENDING_KINDS + NEXT_STEP_KINDS): title "You're eligible for a clinical trial" with an "Eligible" badge, the trial name (item label) + "newly opened, matches your profile", start "See the match" → awaiting → confirm. deriveTodos ranks a trial-match up among the next steps (high-value/novel). Creatable via the dev "Track a pending item" trigger (picker now lists it). General trials stay in the "Worth exploring" content band. Noted product fork (Nick): with records, compute eligibility rather than "check eligibility"; only ask questions when the record is missing them — to design when trials are wired for real. Match data is placeholder.

### redesign-04 — fix16: Chat leaves primary nav → Ask O4M is the AI-first assistant
Chat is a tool, not a destination, so it's out of the bottom nav (now Today · Care plan · Tracker · Community). Chat stays reachable via Ask O4M — the bottom nav remains visible on the chat screen, so leaving is just tapping a tab (no special back needed). Ask O4M reframed as AI-first: the Ask CTA leads its label with the AI (auto_awesome) icon (tile icon unchanged), subtext now "AI first — then your care team," and it opens the AI chat (escalation to a human is the next layer). Added a lightweight "✦ Ask" button to the shared app bar on top-level surfaces (careplan/plan/track/community, not chat) that opens the assistant from anywhere. (AskO4MSheet retained but unused.) Noted (Nick): Tracker may also warrant a fast-track action rather than being only the full management surface — parking spot TBD.

### redesign-04 — fix17: chat is a persistent assistant, not "Ask"
"Ask" implied an ephemeral one-shot (like a form) — wrong for a chat, whose thread persists and is returned to (like Claude). Relabeled the AI entry from "Ask" to Chat: Today CTA now "O4M Chat" · "Your AI — ask anything, anytime" (AI icon leading, tile icon unchanged); app-bar pill now "✦ Chat". "Ask O4M" is reserved for the clinical-team form — the one-off human ask, which is the escalation path from the chat (to build next), not the chat itself.

### redesign-04 — fix18: chat is a slide-up sheet, not a tab/drill-in
Chat now opens as a slide-up sheet over the whole app (chatOpen state, root-level overlay, translateY 100%→0), and closes sliding back down. The primary nav is covered while it's up (the sheet sits above everything). ChatScreen gets sheetMode: its internal bottom nav is hidden, and its home header shows a close (chevron-down) that slides the sheet down. Chat entries (Today CTA + app-bar "Chat") open the sheet instead of switchTab('chat'); deep-links that navigate close the sheet first. Chat is fully out of the tab system now.

### redesign-04 — fix19: chat close is an X on the right of the header
Replaced the left chevron-down close with a close "X" on the right side of the chat header (both the home list and a drilled chat, in sheetMode). Left stays the history menu (home) / back (drilled).

### redesign-04 — fix20: app-bar Chat text uses the dark color (icon stays orange)
The app-bar Chat button's label is now textPrimary; only the AI icon remains orange (accent), keeping orange to the icon/accent role.

### redesign-04 — NOTE (not built): contextual chat prompts
Seed the chat's suggested prompts from the context it was opened in, to lower the "I don't know what to ask" barrier (high-value for this audience — teaches what's askable).
- **Model:** layered blend — evergreen prompts as the floor; a set drawn from the **surface** it was launched from; and if launched from a specific **object**, the object's prompts take priority. Object > surface > evergreen. Ratio not fixed.
- **Surface examples:** Care plan → "What's my next step?", "Why is this treatment suggested?", "What if I wait?"; Community → "How do others handle this?", "Find people like me"; Today → "What changed?", "How am I trending?"; Tracker → "What should I log?", "Is this symptom normal?".
- **App-bar entry** (global) has no specific object → stays evergreen/surface; don't fake object context there.
- **Hooks already exist:** ChatScreen takes a `suggestions` prop; entries call setChatOpen(true) and know activeTab — pass a context object through and compute the set from it.
- **Caveat:** chat is simulated, so contextual prompts demo the intelligence but only pay off once the AI answers well; curation cost per surface is small, worth it for treatments/trials/symptoms first.

---
**Branch checkpoint:** the state above is committed as design branch `redesign-04-today` (v2.18, base `redesign-03-loop`). Home is now Today (its own edited daily surface); the care plan (past · present · future) is a primary nav tab anchored to today, with treatment options carrying their provenance; an eligible clinical-trial match surfaces as a ranked next step; and chat is a persistent AI assistant opened as a slide-up sheet (out of primary nav). Nav: Today · Care plan · Tracker · Community.

### redesign-04 — fix21: contextual chat prompts (built, surface-level)
The chat's suggested prompts are now seeded by the surface it was opened from (evergreen as the floor, contextual set first, capped at 4). openChat() maps the current tab → a context key (careplan→today, plan→careplan, track→track, community→community) and passes it to ChatScreen; CHAT_PROMPTS holds the per-surface sets (Today: "What changed for me today?" / "How am I trending lately?"; Care plan: "What's my next step?" / "Why is this treatment suggested?" / "What happens if I wait?"; Tracker: "What should I be logging?" / "Is this symptom normal?"; Community: "How do others handle this?" / "Find people like me"). Object-level context (a specific treatment/trial/symptom overriding the surface set) is the future extension; the merge already prioritizes contextual over evergreen so it slots in cleanly.

### redesign-04 — fix22: time-of-day mark on the greeting (test)
Added a subtle time-of-day mark to the left of the greeting — sunrise (morning) / sun (afternoon) / moon (evening) in a soft per-time tinted circle. Salutation already matched the time and is first-name-only; tightened the greeting to a single line beside the mark. No background change (per note — kept minimal). Experimental; easy to remove.

---
**Branch checkpoint (FINAL, refreshed):** redesign-04-today, v2.18, base redesign-03-loop — now including contextual chat prompts (fix21), the time-of-day greeting mark (fix22), and redesign-04-rationale.md (the solutions-layer alignment doc following "what the app gives back"). This is the committed state of design 4.

## redesign-04 — check-in redesign (this commit)
- Journal subcopy is a daily-rotating journaling prompt (honors the dev day-offset).
- Check-in items (Mood/Symptoms/Journal) are full-width cards on the spine; check circles + rail stay outside, smaller (22px) and green-filled when done.
- Accordion: one open at a time, opens white; collapsed = warm tint; defaults to the first incomplete open and auto-advances to the next on completion; completed content is not dimmed (collapsed state + green check convey done).
- Mood: inline face select (Rough→Great) → logs + collapses to the result.
- Symptoms & Journal: note the entry in the card and allow editing — one source of truth (shared stores) shown in the check-in, care-plan daily log, and tracker; Edit reopens the flow seeded with the existing entry and updates it by id (no duplicate). Symptom flow and Journal flow made editable.
- "Clear all demo data" added to the bottom of the profile.
