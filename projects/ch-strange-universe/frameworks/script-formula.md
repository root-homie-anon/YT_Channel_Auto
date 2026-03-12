# Script Formula — Strange Universe

> This file defines how the `@script-writer` agent generates long-form video scripts for this channel.
> The agent reads this file at the start of every script generation task.

---

## Channel Identity

**Niche:** UFOs, UAPs, government cover-ups, unexplained aerial phenomena, alien encounters, and fringe science tied to the UFO phenomenon
**Target audience:** Curious adults 25–50, predominantly male, interested in mysteries and unexplained phenomena. They want well-researched, credible content — not sensationalist clickbait. Many are skeptics who enjoy having their skepticism challenged with real evidence. They follow congressional UAP hearings, whistleblower testimony, and declassified documents. They search for terms like "UAP disclosure," "UFO footage explained," "government UFO coverup," "alien encounter evidence," and "Pentagon UFO program."
**Voice and tone:** Investigative and measured, like a documentary narrator who respects the audience's intelligence. Not breathless or conspiratorial — instead, present evidence methodically and let the viewer draw conclusions. Use phrases like "the evidence suggests" rather than "they're hiding the truth." Be willing to say "we don't know" when the evidence is inconclusive. Inject moments of genuine wonder and awe when the material warrants it. Think Lemmino's calm authority crossed with The Why Files' engaging storytelling — minus the comedy sidekick.
**Content rules:** Never present hoaxes as real without labeling them. Always cite sources when referencing government documents, military testimony, or scientific studies. Avoid partisan political framing — UFO disclosure is bipartisan. Do not mock witnesses or experiencers. Do not make definitive claims about alien contact without evidence. Avoid associating with flat earth, QAnon, or other conspiracy ecosystems. Maintain a clear line between "documented and verified" and "alleged and unconfirmed."

---

## Video Defaults

**Target length:** 15–22 minutes
**Target word count:** 2,100–3,100 words (derived from length at ~140 words/minute)
**Script style:** Narrative investigation — structured like a documentary that unfolds a case. Each video follows a central question or mystery, presents evidence layer by layer, and arrives at an honest assessment. Not a listicle. Not an essay. A case file told as a story.

---

## Research Phase

Before generating angle options or writing a single word of script, the agent must research the topic. This step is mandatory — scripts built on research outperform scripts built on training data alone.

### Research Process

1. **Search the topic broadly** — get current information, recent developments, and general landscape. For UFO topics, always check for recent congressional hearings, AARO reports, FOIA releases, and whistleblower developments.
2. **Search for surprising or counterintuitive angles** — what does most UFO content on this topic get wrong or ignore? What declassified documents contradict the popular narrative? What credible witnesses have been overlooked?
3. **Extract and log the following:**
   - 3–5 concrete facts, statistics, or data points that could anchor script sections (e.g., specific dates, case numbers, document reference codes, witness counts, radar data points)
   - 2–3 specific named examples, case studies, or eyewitness accounts relevant to the topic (e.g., the Nimitz encounter, the Rendlesham Forest incident, the Belgian wave)
   - 1–2 counterintuitive or surprising findings that could serve as hook material (e.g., a skeptic who changed their mind, a government program that was larger than reported)
   - Key terms and phrases that reflect how the audience actually searches for and talks about this topic (e.g., "tic-tac UFO," "UAP task force," "orb UAP," "crash retrieval program")
4. **Identify visual and emotional themes** — note imagery, settings, moods, and motifs that naturally emerge from the research. UFO topics often suggest: night skies, radar screens, declassified document close-ups, military installations, desert landscapes, congressional hearing rooms, cockpit footage, and vast empty spaces that imply something unseen.

The agent logs research findings in a structured block before presenting angle options. This research block becomes part of the production brief.

---

## Angle Generation

When the user provides only a topic, the agent must:

1. Generate 2–3 distinct angle/thesis options for that topic
2. Each angle should be meaningfully different — not just variations in tone, but different argumentative or narrative directions
3. Present options to the user with a one-sentence description of each
4. Wait for the user to select, modify, or provide their own before proceeding

Angle options should be informed by:
- This channel's niche and audience — lean toward the investigative and evidential, not the speculative
- What would make a viewer click AND stay until the end — open a mystery that unfolds, don't front-load the answer
- The tone and voice defined above — authoritative, measured, awe-aware

Example angle directions for a topic like "The Nimitz Encounter":
- **The Evidence Trail** — Walk through every piece of corroborating evidence (radar, FLIR, pilot testimony, ship logs) and show how they build a case no single piece can make alone
- **The Cover-Up Architecture** — Focus on what happened AFTER the encounter: who suppressed it, how the footage leaked, and why it took 13 years to reach the public
- **The Physics Problem** — Center the video on the flight characteristics described by Fravor — the acceleration, the lack of control surfaces, the transmedium movement — and why they break known physics

---

## Script Structure

The agent must follow this structure for every long-form script. Do not skip or reorder sections.

---

### 1. HOOK (0:00–0:15, ~50–75 words)

The first thing the viewer hears. No greeting, no channel intro, no "in this video."

Hook styles this channel uses:
- Open with a specific, verifiable detail that sounds impossible (e.g., "In November 2004, the USS Princeton's SPY-1 radar tracked an object descending from 80,000 feet to sea level in less than a second.")
- Drop the viewer into the middle of an encounter (e.g., "Commander Fravor looked down at the ocean and saw something. A white object, 40 feet long, shaped like a Tic Tac, hovering just above the churning water.")
- Pose a question that implies a hidden truth (e.g., "Why did the US government spend $22 million studying UFOs in secret — and then lie about it?")
- State a documented fact that contradicts the official story (e.g., "The Air Force said Project Blue Book found no evidence of extraterrestrial vehicles. The project's own lead scientist disagreed.")

The hook must:
- Work without any visual context — audio-first
- Create an open loop the viewer needs closed
- Lead directly into the intro without a hard break

---

### 2. INTRO (0:15–1:00, ~150–175 words)

Expand on the hook. Establish what this video is about and why it matters to the viewer.

Must include:
- A clear statement of the video's thesis or central question
- A payoff promise — tell the viewer what they'll know or understand by the end (e.g., "By the end of this video, you'll understand exactly why the Pentagon created a secret UFO program — and what they found.")
- A bonus tease — briefly mention something extra covered later to reward viewers who stay (e.g., "And there's one piece of evidence from this case that almost nobody talks about — we'll get to that.")
- Context line if needed — one sentence max establishing why this matters now (e.g., "This comes just weeks after new congressional testimony...")

Do NOT include: generic "welcome back," subscribe asks, lengthy channel explanations.

---

### 3. BODY (1:00–end, ~1,600–2,500 words)

The core content. Broken into sections.

**Section count:** 3–5 sections depending on topic complexity
**Section structure:** Each section follows this internal pattern:
- **Setup** — establish the context: when, where, who, what was known at the time
- **Tension** — introduce the anomaly, the contradiction, or the new evidence that complicates the picture
- **Payoff** — deliver the key finding, testimony, or revelation clearly and directly

**Re-hooks:** After every 2–3 sections, include a re-hook sentence — a bridge that either:
- Teases what's coming next ("But what the crew didn't know was that this wasn't the first time the object had appeared on radar.")
- Introduces a twist or complication ("And then, three weeks later, the footage disappeared from the ship's systems.")
- Asks a question the next section will answer ("So if the military already knew about this, why did they deny it for thirteen years?")

**Image cue markers:** Insert an image cue every ~20 seconds of narration (roughly every 45-50 words). A 15-minute video should have 35-45 image cues total. Do NOT put just one image per section — each body section should have 5-8 image cues distributed throughout the narration. Format:
```
[IMAGE CUE: brief visual description — keep under 30 words, no style instructions]
```
These cues are extracted and passed to `@asset-producer` for Flux generation. The art style is applied automatically from the image framework — image cues should describe ONLY the scene content.

### Image Cue Rules (CRITICAL — read before writing any cue)

**1. Simple compositions only.** One subject, one environment, one mood. Flux generates one image per cue — if you describe a split-screen, overlay, or multi-panel composition, it will fail. Never describe "data overlaid on" or "instrument readouts at the edges."

**2. No screens, UIs, or instrument displays.** Flux cannot render radar screens, FLIR footage, infrared views, HUD overlays, thermal imaging, sonar displays, or any kind of screen-within-image. Instead of "FLIR display showing a heat signature," write "A bright oblong shape hovering above dark churning ocean, seen from far above." Translate what the instrument SHOWS into the actual scene it depicts.

**3. No text in images.** Do not describe headlines, document text, stamps, dates, or any readable words. Flux will produce gibberish text. Instead of "newspaper headline about Pentagon UFOs," write "stack of newspapers on a dark desk under a single amber lamp, heavy shadows."

**4. Bold and graphic over literal.** Think like a comic book artist, not a photographer. Describe the emotional composition: "A massive dark triangle silhouetted against pale sky, a tiny aircraft beside it for scale" beats "A diamond-shaped UAP photographed over Scottish highlands in 1990." Strip away the journalism — give the artist a striking image.

**5. Vary the visual vocabulary.** Avoid repeating the same setup. If you've used "silhouetted figure in a corridor" once, don't use it again. Cycle through: aerial/overhead shots, extreme close-ups of objects, vast empty landscapes with one small element, architectural interiors with dramatic light, symbolic/conceptual compositions.

**6. Favor contrast and scale.** The best cues create visual tension: something enormous next to something small, a bright element in overwhelming darkness, one warm light in a cold environment. These translate well to the Mignola heavy-shadow style.

Image cues for UFO content should emphasize: night skies with anomalous lights, military architecture, vast landscapes, silhouetted figures, atmospheric mystery shots, symbolic objects (locked vaults, sealed envelopes, broken radar dishes). Vary compositions — wide shots, close-ups, overhead angles, through-window perspectives.

---

### 4. BONUS (optional, ~100–150 words)

An over-deliver beyond what was promised in the intro. Teased in the intro, delivered here.

For UFO content, strong bonus material includes: a lesser-known corroborating case, a recently declassified detail, a connection to another famous incident, or a surprising credible voice who weighed in on the topic.

Include only if there's genuine additional value. Do not pad.

---

### 5. OUTRO + CTA (~100–150 words)

Close the loop on the hook and thesis — bring the viewer back to where they started, now with full context.

Then deliver the CTA:
- Ask viewers what they think happened — invite debate in the comments (e.g., "What do you think — is this evidence of something beyond our understanding, or is there an explanation we're missing? Let me know in the comments.")
- Subscribe ask — one line, direct, not pleading ("If you want more investigations like this, subscribe — we go deep on cases like this every week.")
- Point to next video if thematically connected

Keep it clean. One CTA is better than three.

---

## Writing Rules

These apply to every sentence in the script.

- **Write for ears, not eyes.** Short sentences. Contractions. Natural rhythm. Read it aloud — if it sounds stiff, rewrite it.
- **No filler.** Every sentence must do one of three things: add information, build tension, or deliver payoff. Cut everything else.
- **Specificity over generality.** Concrete details, real numbers, named examples always beat vague statements. "A pilot saw something strange" is weak. "Commander David Fravor, a Navy pilot with 18 years of experience, watched a white object the size of a fighter jet hover 50 feet above the Pacific" is strong.
- **Open loops deliberately.** Introduce a question or thread early, hold the answer, deliver it later. Viewers stay to close the loop.
- **One idea per sentence.** No embedded clauses that require re-reading.
- **Active voice.** Passive construction slows pace and reduces impact.
- **Avoid:** throat-clearing phrases ("So today we're going to..."), hedge stacking ("It's kind of like..."), academic tone, and conspiratorial language ("wake up sheeple," "they don't want you to know").
- **Respect uncertainty.** When evidence is ambiguous, say so clearly. Intellectual honesty builds trust and distinguishes this channel from sensationalist competitors.

---

## Output Format

Every script session produces two documents: the script and the production brief. Both are generated in the same pass.

### CRITICAL: Section Granularity

The pipeline generates ONE image per script section and displays it for that section's full duration. To avoid images sitting on screen for minutes at a time, **split the script into many short sections** — each ~15-25 seconds of narration (~35-55 words). A 15-minute video should have **35-45 sections**, not 8-10.

Each section needs:
- `sectionName`: descriptive label (e.g. "HOOK", "INTRO_1", "BODY_SETKA_1", "BODY_SETKA_2")
- `narration`: 35-55 words of script text
- `imageCue`: under 30 words describing the visual — scene content only, no style instructions, no screens/UI/text, bold graphic compositions
- `durationSeconds`: 15-25 seconds

---

### Document 1 — script.md

```
TITLE CONCEPT: [working title]
ANGLE: [one-sentence thesis]
TARGET LENGTH: [X minutes / ~X words]

[HOOK]
[~50 words of narration]
[IMAGE CUE: brief scene description]

[INTRO_1]
[~45 words]
[IMAGE CUE: ...]

[INTRO_2]
[~45 words]
[IMAGE CUE: ...]

[BODY_TOPIC_1]
[~45 words]
[IMAGE CUE: ...]

[BODY_TOPIC_2]
[~45 words]
[IMAGE CUE: ...]

... (continue — 35-45 sections total for a 15-min video)

[OUTRO]
[~45 words]
[IMAGE CUE: ...]

WORD COUNT: [X]
ESTIMATED RUNTIME: [X min]
IMAGE CUE COUNT: [X — should be 35-45]
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

Visual mood: dark and atmospheric, cinematic tension with moments of awe
Color palette: deep navy and black base, cold steel blue highlights, occasional amber or green accent from instrument panels or document lighting
Era / setting: varies by case — military installations, night skies, ocean surfaces, government buildings, archival settings
Style reference: cinematic documentary photography with occasional archival/declassified document aesthetic

Per-section image cues: [extracted from script — list each IMAGE CUE tag in order]
  1. [IMAGE CUE from HOOK/INTRO]
  2. [IMAGE CUE from SECTION 1]
  3. [IMAGE CUE from SECTION 2]
  ... etc.

---

## Music Direction
> Read by: `@asset-producer` (Sonauto music generation)

PRIMARY mood/emotion: investigative tension — the feeling of uncovering something that was meant to stay hidden
SUPPORTING moods (secondary, can shift toward these):
  - Awe and wonder — for moments when the evidence is genuinely extraordinary
  - Unease — for cover-up and suppression segments
AVOID: horror movie stingers, cheesy sci-fi sound effects, upbeat or triumphant tones, anything comedic

Genre/style: dark cinematic ambient with subtle electronic undertones
Energy level: low to medium — music is always background under VO
Tempo feel: slow and deliberate, with occasional builds during key revelations
Instrumentation: deep synth pads, sparse piano, low sub-bass drones, distant metallic textures, occasional strings for emotional weight
Arc: builds subtly through the investigation, pulls back for the outro reflection

---

## Thumbnail Direction
> Read by: `@video-compiler` (thumbnail generation)

PRIMARY concept: [the single strongest visual idea that represents the video's hook]
SUPPORTING context: [what secondary element adds intrigue or contrast]
AVOID: cartoonish aliens, little green men, flying saucers from 1950s sci-fi, anything that looks cheap or unserious

Emotional hook: [what feeling should the thumbnail create in 1 second — usually curiosity, unease, or awe]
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
