# Title Formula — Strange Universe

> This file defines how the `@script-writer` agent generates video titles for this channel.
> Title generation runs after the script is complete and the thumbnail concept is locked.
> The agent reads this file at the start of every title generation task.

---

## Channel Title Preferences

**Title style:** Investigation-driven curiosity — titles frame the video as uncovering something hidden, suppressed, or misunderstood. They imply depth and evidence rather than speculation.
**Tone:** Authoritative and measured with an undercurrent of urgency. Never breathless or sensationalist. The title should read like a documentary headline, not a tabloid.
**Avoid:** All-caps words (except proper acronyms like UFO, UAP, CIA, NASA), exclamation marks, emojis, "You Won't Believe," "SHOCKING," "Must Watch," vague clickbait that the video doesn't deliver, question marks on yes/no questions
**Character target:** 50–60 characters — fits without truncation across all placements
**Hard cap:** 70 characters

---

## The Pairing Principle

Title and thumbnail are a single unit. They split one message across two elements.

The agent must draft every title candidate against the thumbnail concept from the production brief.
For each title, the agent asks: does this title + thumbnail combination create a stronger curiosity gap together than either does alone?

**Pairing patterns:**
- **Thumbnail asks the question, title names the subject** — viewer sees something intriguing visually (a dark military hangar, a glowing object over ocean), title tells them what they're looking at
- **Title makes the claim, thumbnail shows the stakes** — title is provocative ("The Pentagon's Secret UFO Program"), thumbnail shows the evidence (declassified document, military installation)
- **Both create tension from different angles** — title and thumbnail each add a layer the other doesn't, compounding the curiosity gap
- **Thumbnail shows the outcome, title asks how** — before/after dynamic that drives clicks (e.g., thumbnail shows destroyed radar tape, title says "Why the Navy Erased the UFO Evidence")

The agent notes which pairing pattern each title candidate uses.

---

## Structural Patterns

The agent draws from these patterns. Multiple candidates should use different patterns — not variations of the same one.

| Pattern | Structure | UFO Niche Example |
|---------|-----------|---------|
| Curiosity Gap | The [Topic] Nobody Talks About | The UFO Program Nobody Was Supposed to Find |
| Specificity + Stakes | How [Specific Thing] Changed [Big Outcome] | How One Radar Contact Changed Pentagon UFO Policy |
| Revelation Frame | The Truth About [Topic] | The Truth About the Roswell Debris |
| Contradiction | [Accepted Belief] Is Actually [Opposite] | The Air Force's UFO Debunking Was Actually a Cover |
| Direct Keyword | [Primary Keyword]: [Angle Clause] | UAP Disclosure: Why the Pentagon Changed Course |
| The Reframe | Why [Topic] Isn't What You Think | Why the Tic-Tac UFO Isn't What You Think |
| Stakes Escalation | The [Topic] That [Dramatic Consequence] | The Encounter That Shut Down a Nuclear Base |
| Evidence Reveal | [N] Pieces of Evidence That [Outcome] | 4 Declassified Documents That Prove the Cover-Up |

Patterns that work especially well in the UFO niche:
- **The Suppression Frame**: "Why [Authority] Buried [Evidence]" — implies a cover-up with specificity
- **The Witness Frame**: "[Credible Person] Saw [Specific Thing]" — leverages military/government credibility
- **The Timeline Frame**: "What Really Happened at [Specific Place + Date]" — promises a definitive investigation

---

## Construction Rules

- **Keyword front-loaded** — primary keyword (UFO, UAP, or specific case name) in the first 3–4 words for search visibility
- **No question titles that can be answered yes or no** — "Are UFOs real?" is weak. "Why the Pentagon Admitted UFOs Are Real" is strong
- **Numbers beat vague superlatives** — "3 pilots" beats "multiple witnesses," "22 million dollars" beats "a secret budget"
- **Avoid:** "This is...", "So I...", "You won't believe...", "Must watch", generic hyperbole, "BREAKING" (unless it genuinely just broke)
- **Specificity signals quality** — a specific detail in the title implies the video has depth. "The 1980 Rendlesham Forest Encounter" beats "A Famous UFO Case"
- **Emotional target must match thumbnail** — they create one feeling together, not two competing ones
- **Never mislead** — title must accurately represent what the video delivers. Retention collapse from misleading titles kills the channel.
- **Use credibility markers** — mentioning military rank, government agency, or official document lends weight (e.g., "Navy Commander," "Pentagon Report," "Declassified Files")

---

## Inputs Required

The agent pulls these from the production brief before writing any candidates:

- `Core hook phrase` — strongest 3–5 word phrase from the script or hook
- `Primary keyword` — highest-value search term from research
- `Supporting keywords` — 2–3 additional terms
- `Angle in one clause` — distilled thesis
- `Emotional target` — what the title should make the viewer feel
- `Thumbnail concept` — from production brief thumbnail direction block

---

## Output Format

The agent delivers title candidates in this format:

```
TITLE CANDIDATES

Inputs used:
  Primary keyword: [X]
  Core hook phrase: [X]
  Emotional target: [X]
  Thumbnail concept: [X]

---

Option 1: [Title text]
  Pattern: [pattern name]
  Characters: [X]
  Thumbnail pairing: [pairing pattern + one sentence on how they work together]
  Rationale: [one sentence on why this works for this video]

Option 2: [Title text]
  Pattern: [pattern name]
  Characters: [X]
  Thumbnail pairing: [pairing pattern + one sentence on how they work together]
  Rationale: [one sentence on why this works for this video]

Option 3: [Title text]
  Pattern: [pattern name]
  Characters: [X]
  Thumbnail pairing: [pairing pattern + one sentence on how they work together]
  Rationale: [one sentence on why this works for this video]

Option 4: [Title text — optional, only if a clearly distinct angle warrants it]
  Pattern: [pattern name]
  Characters: [X]
  Thumbnail pairing: [pairing pattern + one sentence on how they work together]
  Rationale: [one sentence on why this works for this video]

Option 5: [Title text — optional]
  Pattern: [pattern name]
  Characters: [X]
  Thumbnail pairing: [pairing pattern + one sentence on how they work together]
  Rationale: [one sentence on why this works for this video]

---

AGENT RECOMMENDATION: Option [N]
Reason: [one sentence — why this is the strongest title + thumbnail combination]
```

User selects a title before description and tags generation begins.
Selected title is locked into the production brief and used in the teaser CTA if a short is being produced.
