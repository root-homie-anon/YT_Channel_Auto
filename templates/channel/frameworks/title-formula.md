# Title Formula — [Channel Name]

> This file defines how `@content-strategist` generates video titles for this channel.
> Fill in all bracketed sections before the first production run.
> Title generation runs after the script is complete and the thumbnail concept is locked.
> The agent reads this file at the start of every title generation task.

---

## Channel Title Preferences

**Title style:** [e.g. curiosity-driven / direct and informational / confrontational / narrative]
**Tone:** [e.g. authoritative, conversational, dramatic — must match channel voice]
**Avoid:** [e.g. all-caps words, exclamation marks, emojis, clickbait that the video doesn't deliver]
**Character target:** 50–60 characters — fits without truncation across all placements
**Hard cap:** 70 characters

---

## The Pairing Principle

Title and thumbnail are a single unit. They split one message across two elements.

The agent must draft every title candidate against the thumbnail concept from the production brief.
For each title, the agent asks: does this title + thumbnail combination create a stronger curiosity gap together than either does alone?

**Pairing patterns:**
- **Thumbnail asks the question, title names the subject** — viewer sees something intriguing visually, title tells them what they're looking at
- **Title makes the claim, thumbnail shows the stakes** — title is provocative, thumbnail makes it visceral
- **Both create tension from different angles** — title and thumbnail each add a layer the other doesn't, compounding the curiosity gap
- **Thumbnail shows the outcome, title asks how** — before/after dynamic that drives clicks

The agent notes which pairing pattern each title candidate uses.

---

## Structural Patterns

The agent draws from these patterns. Multiple candidates should use different patterns — not variations of the same one.

| Pattern | Structure | Example |
|---------|-----------|---------|
| Curiosity Gap | The [Topic] Nobody Talks About | The Roman Strategy Nobody Talks About |
| Specificity + Stakes | How [Specific Thing] Changed [Big Outcome] | How One Letter Changed the Course of WWII |
| Revelation Frame | The Truth About [Topic] | The Truth About Passive Income |
| Contradiction | [Accepted Belief] Is Actually [Opposite] | Everything You Know About Sleep Is Wrong |
| Number + Promise | [N] Reasons [Topic] Will [Outcome] | 3 Reasons the Dollar Is Already Dead |
| Direct Keyword | [Primary Keyword]: [Angle Clause] | Ancient Rome: Why It Really Collapsed |
| The Reframe | Why [Topic] Isn't What You Think | Why Motivation Isn't What You Think |
| Stakes Escalation | The [Topic] That [Dramatic Consequence] | The Decision That Ended an Empire |

---

## Construction Rules

- **Keyword front-loaded** — primary keyword in the first 3–4 words for search visibility
- **No question titles that can be answered yes or no** — "Is X bad?" → weak. "Why X Is Destroying Y" → strong
- **Numbers beat vague superlatives** — "3 reasons" beats "many reasons," "the biggest" beats nothing
- **Avoid:** "This is...", "So I...", "You won't believe...", "Must watch", generic hyperbole
- **Specificity signals quality** — a specific detail in the title implies the video has depth
- **Emotional target must match thumbnail** — they create one feeling together, not two competing ones
- **Never mislead** — title must accurately represent what the video delivers. Retention collapse from misleading titles kills the channel.

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
