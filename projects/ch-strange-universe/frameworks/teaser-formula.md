# Teaser Formula — Strange Universe

> This file defines how the `@script-writer` agent generates short-form scripts for this channel.
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
1. **The strongest tension** — the most unresolved question or conflict in the video (e.g., "Why did the Pentagon deny the program existed for 12 years?")
2. **The most surprising finding** — the counterintuitive or shocking element from research (e.g., "The radar tracked the object dropping from 80,000 feet to sea level in 0.78 seconds")
3. **The payoff promise** — what the viewer will understand by the end of the long video
4. **The hook moment** — the single most compelling sentence from the long script's hook or intro

Do NOT extract: conclusions, answers, resolved payoffs, or anything that closes the loop.

### Structure

```
[HOOK — 0:00–0:03, 1–2 sentences]
Immediate scroll-stopper. Drops the viewer into the most shocking or
unsettling moment from the investigation. No warmup, no context, no channel mention.
Must work as the first thing heard with zero prior knowledge.
UFO-specific hooks that stop the scroll: a specific military testimony detail,
a declassified number that sounds impossible, a government contradiction stated flatly.

[BUILD — 0:03–0:45, 3–5 sentences]
Escalate the tension. Add one layer of context that makes the stakes clearer.
For UFO content, this means: establish who the witness is (credibility),
what they saw (specificity), and why the official story doesn't match (contradiction).
Every sentence tightens the loop — never loosens it.
Do not approach a resolution.

[CLIFF — 0:45–1:10, 1–2 sentences]
End on the sharpest unresolved point. The viewer must feel they need the answer.
For UFO content, strong cliffs include: "And then the footage disappeared from
every system on the ship," "The Air Force's own scientist said they were wrong —
and they buried his report," or "What the radar showed next has never been explained."

[CTA — 1:10–1:20, 1 sentence]
Direct pointer to the long video by title. One line only.
Format: "The full investigation is in [EXACT LONG VIDEO TITLE] — link in bio."
Written after the long video title is finalized. Never placeholder.
```

### Mode A Rules
- Never summarize. Never reveal. Never resolve.
- The teaser should feel incomplete by design — that incompleteness is the mechanism.
- If the long video answers "what did the Pentagon find," the teaser asks the question and makes it urgent. That's all.
- Lean heavily on credibility markers — military rank, government agency, official document. These stop the scroll in the UFO niche because they signal "this isn't another blurry video, this is real."
- Target length: 60–90 seconds / ~120–150 words
- Hard cap: 90 seconds

### Mode A Production Brief Output
Append a short brief block for asset production:

```
TEASER BRIEF (Mode A)

Image direction: [reuse 2–3 images from long production brief — specify which ones by cue number]
Reframe note: [9:16 crop considerations — ensure focal point remains centered after vertical crop]
Music: [trim instruction — e.g. "use opening 90 seconds of long track, fade out at 1:20"]
Thumbnail: [short-specific thumbnail concept — should be the most visually arresting single image from the investigation, optimized for the Shorts feed]
```

---

## Mode B — Standalone Short

### Inputs
- Topic provided by user
- Channel config (niche: UFOs/UAP, tone: investigative, audience: curious adults)
- No long script exists

### Angle Generation (same as long form)
1. Agent generates 2–3 distinct angle options for the topic
2. Each option includes: the angle, the recommended structure (see below), and a one-sentence rationale
3. User selects, modifies, or provides their own
4. Agent also surfaces its recommended structure for the chosen angle — user confirms or overrides

### Structure Options

The agent selects the best structure for the topic and angle. Options:

**Hook + Reveal**
Best for: declassified documents, specific statistics, whistleblower claims, surprising government admissions
```
[HOOK] — A specific, verifiable detail that sounds impossible (0:00–0:05)
[PROOF] — The evidence trail: who said it, when, in what context (0:05–0:45)
[REVEAL] — The full implication: what this actually means for the UFO question (0:45–1:10)
[CLOSE] — One punchy closing line that reframes everything (1:10–1:20)
```

**Myth Bust**
Best for: debunking common misconceptions about famous cases, correcting popular UFO narratives
```
[MYTH] — State what most people think they know about this case (0:00–0:05)
[TURN] — "But that's not what actually happened." Begin dismantling with specific evidence (0:05–0:30)
[EVIDENCE] — The real documented story, anchored in dates, names, and sources (0:30–1:00)
[REFRAME] — What this case actually tells us (1:00–1:20)
```

**Story Snap**
Best for: specific encounter narratives, whistleblower stories, military witness accounts
```
[DROP] — Start in the middle of the encounter at its most tense moment (0:00–0:05)
[CONTEXT] — Who this person is and why their testimony matters — military rank, clearance level, expertise (0:05–0:25)
[ESCALATION] — What they saw next, and why it defied explanation (0:25–0:50)
[RESOLUTION] — What happened after: was the evidence preserved or destroyed, was the witness believed or silenced (0:50–1:10)
[BUTTON] — Final line that puts this one case in the bigger picture (1:10–1:20)
```

**Rapid List**
Best for: "X pieces of evidence," "X cases that changed everything," compilation-style shorts
```
[HOOK] — State the number and the promise: "3 pieces of radar data that shouldn't exist" (0:00–0:05)
[ITEMS] — Deliver each item fast with one specific detail per beat (0:05–1:00)
[BEST] — Call out the strongest item as the closer with one extra detail (1:00–1:15)
[OUT] — One sentence wrap that raises the bigger question (1:15–1:20)
```

**Before + After**
Best for: disclosure timeline stories, cases where the official story changed, evidence that was later reclassified
```
[AFTER] — Show the current state first: what we now know (0:00–0:10)
[QUESTION] — "But for 20 years, the official story was completely different." (0:10–0:20)
[PROCESS] — Walk through what changed and why: the FOIA release, the whistleblower, the congressional hearing (0:20–1:00)
[CALLBACK] — Return to what we know now, with the full weight of how long it was hidden (1:00–1:20)
```

### Mode B Rules
- First 3 seconds are everything. If the hook doesn't stop the scroll, nothing else matters.
- Single idea only. No branching, no "and also." One case, one revelation, one contradiction — fully executed.
- The loop must close completely within the short. No unresolved threads.
- Write for silent viewing — the narration carries it without visual context.
- Credibility markers are essential in short form — a military rank or government agency name in the first 5 seconds signals "this is real" and stops the scroll.
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
  PRIMARY: [dominant visual — military installation, night sky, declassified document, radar screen]
  SUPPORTING: [secondary element — atmospheric detail, scale reference]
  AVOID: [aliens, flying saucers, cartoonish elements, bright colors]
  Style: dark cinematic photorealism, documentary aesthetic, desaturated with selective accent color
  Aspect ratio: 9:16 vertical

Music direction:
  PRIMARY mood: investigative tension
  Genre/style: dark cinematic ambient, subtle electronic undertones
  Energy: low — atmospheric background under narration
  Duration target: [match to runtime + 2 sec fade]

Thumbnail direction:
  Concept: [strongest single visual from the short — the most arresting frame]
  Emotional hook: [curiosity, unease, or awe — one only]
  Text overlay: [3–4 words or "none"]
  Format: 9:16 vertical crop
```

---

## Shared Writing Rules (Both Modes)

- **First 3 seconds are non-negotiable.** No greeting, no context, no channel mention. Ever. Drop in with the most arresting detail.
- **One sentence = one idea.** Short sentences. Spoken rhythm. Read it aloud.
- **No filler.** Every word either hooks, builds tension, or delivers. Cut everything else.
- **Specificity wins.** "A Navy commander with 18 years of flight experience" beats "a military pilot" every time.
- **Write for ears.** Contractions, natural cadence, nothing that reads like copy.
- **Active voice only.** Passive construction kills pace in short form especially.
- **Credibility first.** In the UFO niche, the messenger matters as much as the message. Name ranks, agencies, and clearance levels early.

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
