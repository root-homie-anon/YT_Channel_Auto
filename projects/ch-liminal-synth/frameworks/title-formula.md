# title-formula.md — Liminal Synth

## What This File Is
The agent reads this file to generate title candidates for every video.
Titles are generated before descriptions. The locked title feeds into the description formula.

---

## Title Structure

```
[Experience Hook] | [Function Label] for [Benefit 1] & [Benefit 2] [Year]
```

Three segments separated by pipes. Each pipe is a distinct search cluster.

---

## Segment 1 — Experience Hook

A short phrase (3–6 words) that invites the listener into a state. It describes what listening will *feel like* or *do for them* — not what the music sounds like, not the visual aesthetic.

**The hook removes effort from the listener. It acknowledges the struggle — noise, distraction, pressure — and dissolves it. The music is the agent doing the work, not the listener.**

### Hook Rules
- Starts with a verb or "Let" construction
- Present tense, active, direct
- Warm and inviting — never dark, threatening, or abstract
- Describes the experience or outcome of listening
- Relief angle — you don't have to try, the music handles it
- Never reference cyberpunk, neon, city, grid, darkness, or visual aesthetic
- Never use abstract poetic language
- Never use genre names
- Always sounds like something a human would say
- Maximum 6 words

### Hook Vocabulary Bank
Agent generates fresh variations from this territory. Do not copy verbatim — use as directional anchors.

**"Let" constructions — music does the work:**
- Let the Bass Carry You
- Let the Synths Do the Work
- Let the Music Take Over
- Let Go and Lock In
- Let the Beat Ground You
- Let Your Mind Go Quiet
- Let the Mix Handle It
- Let the Synths Think For You

**Action + destination — describes the transition:**
- Fade Into Focus
- Sink Into Your Work
- Find Your Flow State
- Ride the Wave
- Press Play and Focus
- Tune Out the Noise
- Get Lost in the Beat
- Drift Into Deep Work
- Slide Into the Zone

**Relief/permission — addresses the problem directly:**
- Stop Trying, Start Flowing
- The Hard Part Is Over
- Your Brain Will Thank You
- Just Hit Play
- No Effort Required
- The Focus Finds You
- Give Yourself This Hour
- This One's For You

---

## Segment 2 — Function Label

Describes what the music *is* in plain searchable terms. Pure SEO. Always 2–4 words.

### Formula
```
[Depth Modifier] [Genre Descriptor] [Content Type]
```

### Depth Modifiers for Liminal Synth
Always prefix the function label with one of these — they add weight and specificity:
- Deep
- Rich
- Heavy
- Dark
- Layered
- Immersive

### Genre Descriptors
- Synth
- Bass & Synth
- Chillsynth
- Synthwave

### Content Types
- Study Music
- Focus Music
- Work Music
- Deep Work Music
- Concentration Mix
- Chill Mix

### Function Label Rules
- Depth modifier always comes first
- Study Music and Focus Music are highest search volume — default to these
- Use Chill Mix only if music direction from production brief is explicitly ambient/low energy
- Pick the combination that best matches the session's music direction

### Examples
- Deep Synth Study Music
- Rich Bass Focus Music
- Heavy Synth Work Music
- Immersive Chillsynth Study Music
- Layered Synth Deep Work Music

---

## Segment 3 — Benefit + Year

### Formula
```
for [Benefit 1] & [Benefit 2] [Year]
```

### Benefit 1 — Primary
- Deep Focus
- Late Night Focus
- Deep Work
- Concentration
- Flow State

### Benefit 2 — Secondary
- Relaxation
- Productivity
- Studying
- Creative Work
- Stress Relief

### Benefit Rules
- Benefit 1 and Benefit 2 must not overlap semantically
- Deep Focus & Relaxation works — different outcomes
- Deep Focus & Concentration does not work — too similar
- Year always at the end, no comma before it
- Year pulled from system date

---

## Full Title Examples — Liminal Synth

```
Let the Synths Do the Work | Deep Synth Study Music for Concentration & Deep Work 2026
Tune Out the Noise | Heavy Bass Focus Music for Deep Work & Relaxation 2026
The Focus Finds You | Immersive Synth Study Music for Late Night Focus & Productivity 2026
Just Hit Play | Rich Chillsynth Work Music for Deep Focus & Stress Relief 2026
Let the Mix Handle It | Layered Synth Study Music for Concentration & Creative Work 2026
```

### Title Rules
- Total character count: 70–100 characters
- First pipe should land at or before 70 characters — hook + function label visible in search
- Never use ALL CAPS
- Never use more than 2 pipes
- Always include the year
- Hook always in Segment 1 — never buried

---

## Agent Output Format

Generate 4 title candidates. For each:

```
CANDIDATE [N]:
Title: [full title]
Hook type: [which hook pattern was used and why it fits this session]
Function label: [what was chosen and why]
Benefits: [what was chosen and why]
Character count: [number]
Thumbnail pairing note: [which words from this title work as text overlay on the thumbnail]
```

After all 4 candidates:

```
RECOMMENDATION: Candidate [X] — [one sentence reason]
```

Recommendation should favor strongest hook + best keyword coverage. Human makes the final call.
