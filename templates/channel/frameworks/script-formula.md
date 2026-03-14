# Script Formula — [Channel Name]

> This file defines how the `@script-writer` agent generates long-form video scripts for this channel.
> Fill in all bracketed sections before the first production run.
> The agent reads this file at the start of every script generation task.

---

## Channel Identity

**Niche:** [e.g. personal finance, true crime, ancient history]
**Target audience:** [e.g. curious adults 25–45 who want to understand complex topics without jargon]
**Voice and tone:** [e.g. authoritative but conversational, no fluff, treats the viewer as intelligent]
**Content rules:** [e.g. never make specific financial recommendations, avoid partisan politics, don't mention competitors]

---

## Video Defaults

**Target length:** [e.g. 12–15 minutes]
**Target word count:** [e.g. 1,700–2,100 words — derived from length at ~140 words/minute]
**Script style:** [e.g. narrative storytelling / essay-style argument / listicle / documentary]

---

## Research Phase

Before generating angle options or writing a single word of script, the agent must research the topic. This step is mandatory — scripts built on research outperform scripts built on training data alone.

### Research Process

1. **Search the topic broadly** — get current information, recent developments, and general landscape
2. **Search for surprising or counterintuitive angles** — what does most content on this topic get wrong or ignore?
3. **Extract and log the following:**
   - 3–5 concrete facts, statistics, or data points that could anchor script sections
   - 2–3 specific named examples, case studies, or stories relevant to the topic
   - 1–2 counterintuitive or surprising findings that could serve as hook material
   - Key terms and phrases that reflect how the audience actually searches for and talks about this topic
4. **Identify visual and emotional themes** — note imagery, settings, moods, and motifs that naturally emerge from the research (feeds directly into the production brief)

The agent logs research findings in a structured block before presenting angle options. This research block becomes part of the production brief.

---

## Angle Generation

When the user provides only a topic, the agent must:

1. Generate 2–3 distinct angle/thesis options for that topic
2. Each angle should be meaningfully different — not just variations in tone, but different argumentative or narrative directions
3. Present options to the user with a one-sentence description of each
4. Wait for the user to select, modify, or provide their own before proceeding

Angle options should be informed by:
- This channel's niche and audience
- What would make a viewer click AND stay until the end
- The tone and voice defined above

---

## Script Structure

The agent must follow this structure for every long-form script. Do not skip or reorder sections.

---

### 1. HOOK (0:00–0:15, ~50–75 words)

The first thing the viewer hears. No greeting, no channel intro, no "in this video."

Hook styles this channel uses:
- [e.g. Open with a shocking or counterintuitive fact]
- [e.g. Drop the viewer into the middle of a story]
- [e.g. Pose a question that creates immediate curiosity]
- [e.g. Make a bold claim that demands to be explained]

The hook must:
- Work without any visual context — audio-first
- Create an open loop the viewer needs closed
- Lead directly into the intro without a hard break

---

### 2. INTRO (0:15–1:00, ~150–175 words)

Expand on the hook. Establish what this video is about and why it matters to the viewer.

Must include:
- A clear statement of the video's thesis or central question
- A payoff promise — tell the viewer what they'll know or understand by the end
- A bonus tease — briefly mention something extra covered later to reward viewers who stay
- [Optional: one-line channel/topic context if this is a standalone video — keep it under 10 words]

Do NOT include: generic "welcome back," subscribe asks, lengthy channel explanations.

---

### 3. BODY (1:00–end, ~1,300–1,700 words)

The core content. Broken into sections.

**Section count:** [e.g. 3–5 sections depending on topic]
**Section structure:** Each section follows this internal pattern:
- **Setup** — why this section matters, what question it answers
- **Tension** — build toward the key information, add context, raise stakes
- **Payoff** — deliver the information clearly and directly

**Re-hooks:** After every 2–3 sections, include a re-hook sentence — a bridge that either:
- Teases what's coming next ("But here's where it gets interesting...")
- Introduces a twist or complication
- Asks a question the next section will answer

**Image cue markers:** At each natural section break, the agent must insert a cue in this format:
```
[IMAGE CUE: brief description of the visual context for this section]
```
These cues are extracted by `@content-strategist` and passed to `@asset-producer` for Flux generation.

---

### 4. BONUS (optional, ~100–150 words)

An over-deliver beyond what was promised in the intro. Teased in the intro, delivered here.

[e.g. An extra tip, a surprising implication, a related fact that reframes everything]

Include only if there's genuine additional value. Do not pad.

---

### 5. OUTRO + CTA (~100–150 words)

Close the loop on the hook and thesis — bring the viewer back to where they started, now with full context.

Then deliver the CTA:
- [e.g. Ask viewers to comment with their opinion/answer to a question]
- [e.g. Subscribe ask — one line, direct, not pleading]
- [e.g. Point to next video]

Keep it clean. One CTA is better than three.

---

## Writing Rules

These apply to every sentence in the script.

- **Write for ears, not eyes.** Short sentences. Contractions. Natural rhythm. Read it aloud — if it sounds stiff, rewrite it.
- **No filler.** Every sentence must do one of three things: add information, build tension, or deliver payoff. Cut everything else.
- **Specificity over generality.** Concrete details, real numbers, named examples always beat vague statements.
- **Open loops deliberately.** Introduce a question or thread early, hold the answer, deliver it later. Viewers stay to close the loop.
- **One idea per sentence.** No embedded clauses that require re-reading.
- **Active voice.** Passive construction slows pace and reduces impact.
- **Avoid:** throat-clearing phrases ("So today we're going to..."), hedge stacking ("It's kind of like..."), and academic tone.

---

## Output Format

Every script session produces two documents: the script and the production brief. Both are generated in the same pass.

---

### Document 1 — script.md

```
TITLE CONCEPT: [working title — not final, used for reference]
ANGLE: [one-sentence thesis locked in before writing]
TARGET LENGTH: [X minutes / ~X words]

---

[HOOK]
[script text]
[IMAGE CUE: ...]

[INTRO]
[script text]
[IMAGE CUE: ...]

[SECTION 1: Section Title]
[script text]
[IMAGE CUE: ...]

[SECTION 2: Section Title]
[script text]
[IMAGE CUE: ...]

[RE-HOOK]
[script text]

[SECTION 3: Section Title]
[script text]
[IMAGE CUE: ...]

[BONUS] ← omit block if not applicable
[script text]
[IMAGE CUE: ...]

[OUTRO + CTA]
[script text]

---

WORD COUNT: [X]
ESTIMATED RUNTIME: [X min]
IMAGE CUE COUNT: [X]
```

---

### Document 2 — production-brief.md

The production brief is the single reference document for all downstream agents. It is generated from research findings and the finalized script. Every agent reads this before doing their work.

```
# Production Brief — [Video Title Concept]

TOPIC: [topic]
ANGLE: [one-sentence thesis]
ESTIMATED RUNTIME: [X min]

---

## Research Findings

FACTS + STATS:
- [fact 1 with source]
- [fact 2 with source]
- [fact 3 with source]

KEY EXAMPLES / STORIES:
- [example 1]
- [example 2]

HOOK MATERIAL (surprising / counterintuitive):
- [finding 1]
- [finding 2]

AUDIENCE LANGUAGE (how they search/talk about this):
- [term/phrase 1]
- [term/phrase 2]
- [term/phrase 3]

---

## Image Direction
> Read by: `@asset-producer` (Flux image generation)

PRIMARY subject/motif: [the dominant visual concept across most images]
SUPPORTING subjects/motifs:
  - [secondary motif 1]
  - [secondary motif 2]
AVOID: [visual elements, styles, or subjects to exclude]

Visual mood: [e.g. cinematic, dark and atmospheric, warm and human, stark and minimal]
Color palette: [e.g. desaturated blues and grays with occasional amber, rich earth tones]
Era / setting: [e.g. contemporary urban, ancient, futuristic, timeless abstract]
Style reference: [e.g. documentary photography, oil painting, photorealistic render]

Per-section image cues: [extracted from script — list each IMAGE CUE tag in order]
  1. [IMAGE CUE from HOOK/INTRO]
  2. [IMAGE CUE from SECTION 1]
  3. [IMAGE CUE from SECTION 2]
  ... etc.

---

## Music Direction
> Read by: `@asset-producer` (music generation)

PRIMARY mood/emotion: [the dominant emotional tone the music must carry]
SUPPORTING moods (secondary, can shift toward these):
  - [mood 2]
  - [mood 3]
AVOID: [genres, tempos, or instruments that would clash with this content]

Genre/style: [e.g. cinematic orchestral, lo-fi ambient, dark electronic, acoustic folk]
Energy level: [low / medium / medium-high — music is always background under VO]
Tempo feel: [e.g. slow and deliberate, steady pulse, gently evolving]
Instrumentation: [e.g. strings + piano, synth pads + subtle percussion, acoustic guitar]
Arc: [does the music stay consistent or shift — e.g. "builds gradually to section 3 then pulls back for outro"]

---

## Thumbnail Direction
> Read by: `@video-compiler` (thumbnail generation)

PRIMARY concept: [the single strongest visual idea that represents the video's hook]
SUPPORTING context: [what secondary element adds intrigue or contrast]
AVOID: [anything that would dilute or confuse the thumbnail message]

Emotional hook: [what feeling should the thumbnail create in 1 second — e.g. shock, curiosity, desire]
Text overlay: [3–5 word phrase if applicable — or "none"]
Best candidate image: [reference the IMAGE CUE most likely to yield the strongest thumbnail]
Composition note: [e.g. single focal point left, negative space right for text, close crop]

---

## Title Direction
> Read by: `@script-writer` (title generation pass)

Core hook phrase: [the most potent 3–5 word phrase from the script or hook]
Primary keyword: [highest-value search term identified in research]
Supporting keywords: [2–3 additional terms]
Angle in one clause: [distilled thesis as a short clause]
Emotional target: [what should the title make the viewer feel — curiosity, urgency, surprise]
```
