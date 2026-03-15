# description-formula.md — Music Only Channels (Shared)

## What This File Is
The agent reads this file to generate the full video description after the title is locked.
The agent pulls music context, visual context, genre/mood/style from the production brief.
The locked title is required before generation begins.

---

## Inputs Required Before Generation

- `[LOCKED_TITLE]` — finalized title from title-formula.md output
- `[MUSIC_CONTEXT]` — from production brief: genre, style, mood, instrumentation, energy arc
- `[VISUAL_CONTEXT]` — from production brief: image concept, visual mood, aesthetic per segment
- `[SEGMENT_COUNT]` — number of segments in this video
- `[SEGMENT_DURATION]` — duration per segment in minutes
- `[TOTAL_DURATION]` — total video length
- `[CHANNEL_CONFIG]` — from config.json: channel name, CTA block, tool credits toggle, fixed hashtags

---

## Description Structure — Full Assembly Order

```
Block 1  — Above the Fold
Block 2  — Immersion Copy
Block 3  — Perfect For
Block 4  — Focus Tips
⸻
Block 5  — Visual Context Line (static)
Block 6  — Feature Block
Block 7  — Metadata Lines
⸻
Block 8  — Tool Credits
Block 9  — CTA Block
⸻
Block 10 — Hashtags
⸻
Block 11 — Tracklist [TBD]
Block 12 — Copyright
```

---

## Block 1 — Above the Fold

**Purpose:** First 2–3 lines visible before Show More. SEO core — maximum keyword density in natural prose.
**Regenerates:** Every video. Content is dynamic, structure is fixed.

### Formula
```
[OPENING_LINE] [MUSIC_STYLE_DESCRIPTION], crafted for [PRIMARY_USE_CASE].
This mix serves as ideal [FUNCTION_LABEL_1], [FUNCTION_LABEL_2], [FUNCTION_LABEL_3], and [FUNCTION_LABEL_4] —
[HOOK_ECHO from locked title].
```

### Opening Line Pool (30 options — agent selects randomly, tracks last used to avoid consecutive repeats)
01. Immerse yourself in
02. Sink into
03. Lose yourself in
04. Step into
05. Let yourself drift into
06. Dive deep into
07. Slip into
08. Disappear into
09. Surrender to
10. Get absorbed in
11. Settle into
12. Fall into
13. Melt into
14. Float through
15. Wander into
16. Ease into
17. Breathe into
18. Dissolve into
19. Get pulled into
20. Find yourself inside
21. Let yourself get lost in
22. Tune into
23. Lock into
24. Press play on
25. Drift through
26. Move through
27. Ride through
28. Travel through
29. Rest inside
30. Anchor yourself in

### Rules
- Must include: both genre names from the title, both benefit words from the title, at least two function labels
- Write as natural prose — not a list, not robotic
- Last clause must echo the hook from the locked title
  - If title hook is "Let the Synths Do the Work" → "let the synths handle the rest while your focus takes over"
  - If title hook is "Tune Out the Noise" → "tune out everything else and let your concentration take hold"
  - If title hook is "The Focus Finds You" → "the focus finds you without you having to chase it"
- Never start with the channel name
- Never start with "Welcome"

---

## Block 2 — Immersion Copy

**Purpose:** Emotional and experiential sell. Converts browsers into watchers.
**Length:** 2–3 sentences.
**Icon:** 🌌
**Regenerates:** Every video. Pulled from MUSIC_CONTEXT and VISUAL_CONTEXT in production brief.

### Formula
```
🌌 [SENSORY_DESCRIPTION — what the music physically does to the listener]
[EMOTIONAL_OUTCOME — what state the listener reaches]
[PERMISSION LINE — tell them to let go, echoes relief angle from title hook]
```

### Opening Line Pool (30 options — agent selects randomly, tracks last used to avoid consecutive repeats)
01. Let the deep bass pulses and layered synth textures
02. As the heavy synth layers and melodic basslines
03. Feel the rhythmic low-end and atmospheric pads
04. Let the rolling bass and interlocking synth lines
05. As the dense bass textures and melodic loops
06. The deep synth layers and driving bass
07. Let the pulsing low frequencies and ambient textures
08. As the bass-heavy foundation and melodic synths
09. Feel the thick synth atmosphere and steady bass pulse
10. Let the layered bass and melodic synth progressions
11. As the heavy electronic textures and rhythmic bass
12. The immersive synth layers and deep bass undertones
13. Let the dark melodic lines and bass-forward mix
14. As the dense electronic atmosphere and bass pulses
15. Feel the interlocking synth layers and deep low-end
16. Let the rich bass foundation and atmospheric synths
17. As the melodic synth textures and driving bass lines
18. The heavy bass and layered electronic atmosphere
19. Let the deep electronic layers and melodic bass
20. As the thick synth textures and rhythmic low-end
21. Feel the bass-forward mix and ambient synth layers
22. Let the immersive low frequencies and melodic pads
23. As the deep synth atmosphere and bass foundation
24. The layered electronic textures and heavy bass pulse
25. Let the driving bass and melodic synth lines
26. As the rich low-end and atmospheric synth layers
27. Feel the dense bass textures and melodic electronic lines
28. Let the heavy synth atmosphere and bass undertones
29. As the immersive electronic layers and deep bass
30. The melodic bass lines and layered synth atmosphere

### Rules
- Draw from VISUAL_CONTEXT and MUSIC_CONTEXT in production brief for the middle sentence
- Must include at least one atmospheric reference to the visual world — keep it subtle, never aesthetic-forward
- Permission line at the end should echo the relief angle from the title hook
- Never use the word "journey" or "escape"

---

## Block 3 — Perfect For

**Purpose:** Catches skimmers. Signals use cases to algorithm.
**Icon:** 🎧
**Structure:** Single line, comma separated, always ends with "or [final use case]"

### Fixed use cases for Liminal Synth (always include all of these)
Deep Focus sessions, Studying, Working Late, Coding, Creative Work, Relaxation, or Stress Relief

---

## Block 4 — Focus Tips

**Purpose:** Boosts watch time by setting up a ritual. Static — never changes.

```
🎯 Simple Tips to Stay in Flow:
• Start with Intention: Set one clear goal before you press play.
• Block Distractions: Use headphones and full screen for full immersion.
```

---

## Divider
```
⸻
```

---

## Block 5 — Visual Context Line

**Purpose:** Identity statement. Bridges tips block to feature block. Static — never changes for Liminal Synth.

```
For the ones who work when the city goes quiet.
```

---

## Block 6 — Feature Block

**Purpose:** Restates locked title for mid-description keyword indexing. Identity lines reinforce channel voice.
**First line regenerates every video (locked title). ✔ lines are fixed for Liminal Synth.**

```
✨ [LOCKED_TITLE] is designed for:
✔ Late Night Focus & Deep Work
✔ Studying, Coding & Creative Flow
✔ Unwinding Without Switching Off
✔ The Hours When It's Just You and the Music
```

---

## Block 7 — Metadata Lines

**Purpose:** Structured data for YouTube algorithm.
**Genre line is fixed. Mood and Style are dynamic with fixed anchors.**

### Formula
```
🎧 Mood: [MOOD_ANCHORS] + [DYNAMIC_MOODS from production brief]
🎶 Genre: Electronic Music
🎵 Style: [STYLE_ANCHORS] + [DYNAMIC_STYLES from production brief]
```

### Fixed Anchors — Liminal Synth
- Mood anchors (always included): Calm, Atmospheric
- Style anchors (always included): Chillsynth, Dark Synth

### Dynamic Additions
- Agent pulls remaining mood and style descriptors from MUSIC_CONTEXT in production brief
- Mood: 4–6 total descriptors
- Style: 4–6 total descriptors
- Dynamic additions must not duplicate anchors

### Example Output
```
🎧 Mood: Calm, Atmospheric, Focused, Hypnotic, Melancholic
🎶 Genre: Electronic Music
🎵 Style: Chillsynth, Dark Synth, Downtempo, Deep Bass, Melodic Electronic, Ambient
```

---

## Divider
```
⸻
```

---

## Block 8 — Tool Credits

**Toggle:** Controlled by `config.json → toolCredits: true/false`
**Static template — use verbatim when enabled:**

```
🎵 Music generated with Stable Audio 2.5
🖼️ Visuals created with Flux
🎞️ Animations created with Runway
```

---

## Block 9 — CTA Block

**Pulled entirely from config.json — agent does not generate this.**
If CTA block is empty in config, skip entirely. No placeholder text.

```json
"cta": {
  "supportLink": "",
  "supportLabel": "",
  "subscribeNote": "",
  "additionalLinks": []
}
```

---

## Divider
```
⸻
```

---

## Block 10 — Hashtags

**Total per video: 11 tags.**
**Three clusters separated by line breaks.**
**Cluster order: Channel → Genre → Function → Vibe**

### Channel Tags (3) — Fixed every video, never rotates
```
#LiminalSynth #Synthwave #DeepSynth
```

### Genre Tags (3) — 1 fixed anchor + 2 rotate from pool
Fixed anchor (always included): `#Chillsynth`
Rotation pool: `#DarkSynth #AmbientMusic #ElectronicMusic #Downtempo #MelodicElectronic #DeepBass #ChillElectronic`
Agent picks 2 from pool each video. Tracks last used — do not repeat same 2 consecutively.

### Function Tags (3) — 1 fixed anchor + 2 rotate from pool
Fixed anchor (always included): `#StudyMusic`
Rotation pool: `#DeepFocusMusic #RelaxationMusic #WorkMusic #ProductivityMusic #CodingMusic #DeepFocus #ChillMusic #StressRelief #Studying #Working #ChillOut`
Agent picks 2 from pool each video. Tracks last used — do not repeat same 2 consecutively.

### Vibe Tags (2) — fully rotates from pool
Pool: `#latenight #cityvibes #nightcity #chillvibes #midnightvibes #urbannight #bassmusic #focusmode #flowstate`
Agent picks 2 randomly. Tracks last used — do not repeat same 2 consecutively.

### Hashtag Output Format
```
#LiminalSynth #Synthwave #DeepSynth
#Chillsynth #[GENRE_2] #[GENRE_3]
#StudyMusic #[FUNCTION_2] #[FUNCTION_3]
#[VIBE_1] #[VIBE_2]
```

---

## Divider
```
⸻
```

---

## Block 11 — Tracklist / Timestamps

**Applies to:** Multi-segment music-only videos only. Skip for single-segment or narrated videos.

**Source:** `compilationResult.segmentTimestamps` array from compilation-result.json.

**Format:**
```
0:00 [Scene Name]
3:07 [Scene Name]
6:14 [Scene Name]
```

**Rules:**
- First timestamp must always be `0:00` (YouTube requirement for chapters)
- Minimum 3 chapters required for YouTube to render them (pad with segment splits if fewer)
- Scene names come from the agent's metadata generation — default labels are `Scene 1`, `Scene 2`, etc.
- The agent SHOULD replace default labels with evocative scene names from the title formula's Scene Name Pool or drawn from the image prompt's environment/atmosphere
- Format timestamps as `H:MM:SS` for videos over 1 hour, `M:SS` for shorter videos
- Place between the summary and the CTA line in the description

---

## Block 12 — Copyright

**Static — never changes. Channel name pulled from config.json.**

```
© Strong Tower Media LLC – All rights reserved.
✔ All music and visuals are original and created by Strong Tower Media LLC using AI tools.
✔ Unauthorized use, reuploads, or modifications are not permitted.
```

---

## Agent Output Format

Generate the full description in one pass. Do not label blocks in the output — final description reads as a clean YouTube description with no headers or agent annotations.

After the description, output a separate section:

```
--- GENERATION NOTES ---
Opening line used (Block 1): [which opener from the pool]
Opening line used (Block 2): [which opener from the pool]
Hook echo: [what phrase from title was echoed in Block 1]
Music context applied: [key terms pulled from production brief]
Visual context applied: [key terms pulled from production brief]
Genre tags selected: [fixed anchor + 2 rotation picks]
Function tags selected: [fixed anchor + 2 rotation picks]
Vibe tags selected: [2 rotation picks]
Mood descriptors: [anchors + dynamic additions]
Style descriptors: [anchors + dynamic additions]
```

Generation notes are for internal review only — never included in the final posted description.
