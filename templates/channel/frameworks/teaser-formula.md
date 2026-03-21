# Teaser Formula — [Channel Name]

> This file defines how `@content-strategist` generates short-form teaser scripts for this channel.
> Fill in all bracketed sections before the first production run.
> The agent reads this file at the start of every short/teaser script generation task.

---

## Mode Detection

Before writing anything, the agent must determine which mode applies:

**Mode A — Derived Teaser (long video exists)**
- Condition: A completed `script.md` and `production-brief.md` exist in the current session
- Goal: Open a loop that only the long video can close. Drive viewers to watch the full video.
- The short is a setup, not a summary. Never resolve the tension.

**Mode B — Standalone Short (no long video)**
- Condition: No long script exists, OR user explicitly requests a standalone short
- Goal: Deliver complete, self-contained value within 90 seconds. Loop opens and closes within the short itself.

The agent states which mode it is entering at the start of the task.

---

## Mode A — Derived Teaser

### Inputs
- `script.md` — full long-form script from current session
- `production-brief.md` — production brief from current session
- Finalized long video title — required before writing the CTA line

### What to Extract from the Long Script
The agent must identify:
1. **The strongest tension** — the most unresolved question or conflict in the video
2. **The most surprising finding** — the counterintuitive or shocking element from research
3. **The payoff promise** — what the viewer will understand by the end of the long video
4. **The hook moment** — the single most compelling sentence from the long script's hook or intro

Do NOT extract: conclusions, answers, resolved payoffs, or anything that closes the loop.

### Structure

```
[HOOK — 0:00–0:03, 1–2 sentences]
Immediate scroll-stopper. Drops the viewer into the strongest tension or most
surprising finding. No warmup, no context, no channel mention.
Must work as the first thing heard with zero prior knowledge.

[BUILD — 0:03–0:45, 3–5 sentences]
Escalate the tension. Add one layer of context that makes the stakes clearer.
Introduce a second thread if it strengthens the curiosity gap.
Every sentence tightens the loop — never loosens it.
Do not approach a resolution.

[CLIFF — 0:45–1:10, 1–2 sentences]
End on the sharpest unresolved point. The viewer must feel they need the answer.
A question works. A provocative incomplete claim works.
A cut-off revelation works. A resolved answer does not.

[CTA — 1:10–1:20, 1 sentence]
Direct pointer to the long video by title. One line only.
Format: "The full story is in [EXACT LONG VIDEO TITLE] — link in bio."
Written after the long video title is finalized. Never placeholder.
```

### Mode A Rules
- Never summarize. Never reveal. Never resolve.
- The teaser should feel incomplete by design — that incompleteness is the mechanism.
- If the long video answers "why did X happen," the teaser asks the question and makes it urgent. That's all.
- Target length: 60–90 seconds / ~120–150 words
- Hard cap: 90 seconds

### Mode A Production Brief Output
Append a short brief block for asset production:

```
TEASER BRIEF (Mode A)

Image direction: [reuse 2–3 images from long production brief — specify which ones by cue number]
Reframe note: [any 9:16 crop considerations for selected images]
Music: [trim instruction — e.g. "use opening 90 seconds of long track, fade out at 1:20"]
Thumbnail: [short-specific thumbnail concept — can differ from long thumbnail]
```

---

## Mode B — Standalone Short

### Inputs
- Topic provided by user
- Channel config (niche, tone, audience, content rules)
- No long script exists

### Angle Generation (same as long form)
1. Agent generates 2–3 distinct angle options for the topic
2. Each option includes: the angle, the recommended structure (see below), and a one-sentence rationale
3. User selects, modifies, or provides their own
4. Agent also surfaces its recommended structure for the chosen angle — user confirms or overrides

### Structure Options

The agent selects the best structure for the topic and angle. Options:

**Hook + Reveal**
Best for: facts, history, science, surprising data
```
[HOOK] — Shocking or counterintuitive claim (0:00–0:05)
[PROOF] — Evidence and context that validates the claim (0:05–0:45)
[REVEAL] — The full payoff — why this matters or what it means (0:45–1:10)
[CLOSE] — One punchy closing line that makes it memorable (1:10–1:20)
```

**Myth Bust**
Best for: topics with widespread misconceptions, contrarian angles
```
[MYTH] — State the common belief confidently (0:00–0:05)
[TURN] — "Here's the problem with that." Begin dismantling (0:05–0:30)
[EVIDENCE] — The real story, concrete and specific (0:30–1:00)
[REFRAME] — New way of thinking about it (1:00–1:20)
```

**Story Snap**
Best for: true crime, history, biography, narrative niches
```
[DROP] — Start in the middle of the story at its most tense moment (0:00–0:05)
[CONTEXT] — Who, what, where — only what's needed (0:05–0:25)
[ESCALATION] — How it got worse or more complicated (0:25–0:50)
[RESOLUTION] — How it ended. Complete the arc. (0:50–1:10)
[BUTTON] — Final line that reframes or lands the meaning (1:10–1:20)
```

**Rapid List**
Best for: tips, rankings, comparisons, any numbered content
```
[HOOK] — State the number and the promise (0:00–0:05)
[ITEMS] — Deliver each item fast, one per beat (0:05–1:00)
[BEST] — Call out the strongest item as the closer (1:00–1:15)
[OUT] — One sentence wrap (1:15–1:20)
```

**Before + After**
Best for: transformation, process, results-driven content
```
[AFTER] — Show or describe the outcome first (0:00–0:10)
[QUESTION] — "How?" or "Why?" — make the viewer want the process (0:10–0:20)
[PROCESS] — Walk through what caused the transformation (0:20–1:00)
[CALLBACK] — Return to the outcome with new understanding (1:00–1:20)
```

### Mode B Rules
- First 3 seconds are everything. If the hook doesn't stop the scroll, nothing else matters.
- Single idea only. No branching, no "and also." One concept, fully executed.
- The loop must close completely within the short. No unresolved threads.
- Write for silent viewing — the narration carries it without visual context.
- Target length: 30–60 seconds ideal / ~75–100 words
- Hard cap: 90 seconds / ~150 words

### Mode B Production Brief Output

```
TEASER BRIEF (Mode B)

TOPIC: [topic]
ANGLE: [one-sentence thesis]
STRUCTURE USED: [structure name]
ESTIMATED RUNTIME: [X sec / ~X words]

Image direction:
  PRIMARY: [dominant visual concept]
  SUPPORTING: [secondary element]
  AVOID: [exclusions]
  Style: [mood, palette, aesthetic]
  Aspect ratio: 9:16 vertical

Music direction:
  PRIMARY mood: [dominant emotional tone]
  Genre/style: [e.g. lo-fi, cinematic, electronic]
  Energy: [low / medium / high]
  Duration target: [match to runtime + 2 sec fade]

Thumbnail direction:
  Concept: [strongest single visual from the short]
  Emotional hook: [what feeling in 1 second]
  Text overlay: [3–4 words or "none"]
  Format: 9:16 vertical crop
```

---

## Shared Writing Rules (Both Modes)

- **First 3 seconds are non-negotiable.** No greeting, no context, no channel mention. Ever.
- **One sentence = one idea.** Short sentences. Spoken rhythm. Read it aloud.
- **No filler.** Every word either hooks, builds tension, or delivers. Cut everything else.
- **Specificity wins.** A named example beats a vague category every time.
- **Write for ears.** Contractions, natural cadence, nothing that reads like copy.
- **Active voice only.** Passive construction kills pace in short form especially.

---

## Output Format

```
MODE: [A — Derived Teaser / B — Standalone Short]
STRUCTURE: [structure name — Mode B only]
ANGLE: [one-sentence thesis]
TARGET LENGTH: [X sec / ~X words]

---

[HOOK]
[script text]

[BUILD / PROOF / MYTH / DROP / AFTER / ITEMS — label per structure]
[script text]

[CLIFF / REVEAL / REFRAME / RESOLUTION / BEST — label per structure]
[script text]

[CTA / CLOSE / BUTTON / OUT — label per structure]
[script text]

---

WORD COUNT: [X]
ESTIMATED RUNTIME: [X sec]

---

[TEASER BRIEF]
[brief block per mode]
```
