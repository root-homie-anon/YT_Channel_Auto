# Music Framework

> This file defines how `@asset-producer` generates music for all channel types.
> Music is generated via Stable Audio 2.5 on Replicate (`src/services/replicate-audio-service.ts`).
> Track A: one background track per video, sits under VO, fresh generation per video.
> Track B: one ~30-minute track per segment, the primary content of the video.

---

## How It Works

### Two Sources of Direction

```
SOURCE 1: Channel music-framework.md  → defines the standing style, mood, and genre for this channel
SOURCE 2: Production brief (Track A)  → per-video music direction block with primary/supporting/avoid
          Session input (Track B)     → user-provided music concept for this session
```

The agent combines both sources. Channel framework sets the outer boundaries. Per-video direction steers within those boundaries. A session input that conflicts with the channel framework is flagged — agent asks user to confirm before proceeding.

### Track A vs Track B Generation

| | Track A | Track B |
|---|---------|---------|
| Duration | ~3–5 min (matches video) | ~30 min per segment |
| Role | Background layer under VO | Primary content |
| Volume | Low — VO sits on top | Full — no VO competing |
| Source | Production brief music direction | Session music concept |
| Reuse | Never reused — fresh per video | Never reused — fresh per segment |
| Short format | Trimmed from long track | N/A |

---

## Stable Audio 2.5 Prompt Construction

Stable Audio 2.5 works best with concise, natural-language prompts. No labeled sections — just a comma-separated description.

### Track A Prompt Template (background under VO)

```
[Category name] instrumental, [primary instruments], [BPM] BPM, [user direction if any], no lyrics, background ambient
```

Example: `Lofi Study instrumental, lo-fi piano, soft drums, vinyl crackle, 75 BPM, no lyrics, background ambient`

### Track B Prompt Template (primary content, music-only channels)

```
[Category name] instrumental, [primary instruments], [BPM] BPM, [user direction if any], no lyrics
```

Example: `Synthwave instrumental, synthesizer arpeggios, gated reverb drums, bass synth, 110 BPM, driving neon-lit mood, no lyrics`

### Key rules
- Max 190 seconds per generation — loop or stitch for longer durations
- Keep prompts under 200 characters for best results
- Comma-separated natural language, not labeled fields
- Genre + instruments + tempo + mood is the core formula

---

## Category Defaults

The following defaults apply when the channel framework matches one of these categories. Override with production brief or session input direction.

---

### LOFI / STUDY / JAZZHOP

**Default Energy:** Low — gentle, unhurried
**Default BPM:** 65–85
**Default Instrumentation:** Lo-fi piano or electric piano, soft drums with vinyl crackle, occasional muted guitar, light bass. Subtle tape warmth throughout.
**Mood Range:** Cozy / nostalgic / focused / melancholy-adjacent but not sad
**Structure:** Looping motif with gentle variation. No builds or drops. Consistent presence.
**Avoid:** Lyrics, prominent melodic solos that demand attention, high energy percussion, bright clean production

---

### JAZZHOP / CAFÉ

**Default Energy:** Low-medium — relaxed but alive
**Default BPM:** 75–95
**Default Instrumentation:** Upright bass, brushed snare, jazz piano chords, optional soft trumpet or saxophone in background. Warm room presence.
**Mood Range:** Intimate / warm / evening / nostalgic
**Structure:** Jazz chord progression with subtle improvisation feel. Loose and organic. Never mechanical.
**Avoid:** Lyrics, loud solos, electronic elements, sharp attack on any instrument

---

### CHILLHOP / BEDROOM

**Default Energy:** Low — soft and intimate
**Default BPM:** 70–90
**Default Instrumentation:** Dusty samples, soft boom-bap drums, warm synth pads, light piano or guitar. Occasional vinyl texture.
**Mood Range:** Introspective / warm / late-night / gentle
**Structure:** Sample-loop based feel with gentle variation. Repetitive by design — hypnotic not boring.
**Avoid:** Lyrics, hard hitting percussion, sharp highs, anything that feels bright or polished

---

### DARK AMBIENT

**Default Energy:** Ambient — near silence, dense texture
**Default BPM:** No discernible tempo — generative drone-based
**Default Instrumentation:** Deep sub-bass drones, slow-evolving synthesizer pads, distant metallic resonance, processed field recordings of industrial or cavernous spaces. Absolute minimal.
**Mood Range:** Oppressive / vast / ancient / dormant / pre-event tension
**Structure:** Evolving drone with very slow textural changes. No melodic content. No rhythm. Pure atmosphere.
**Avoid:** Any melody, any recognizable rhythm, bright tones, warm instruments, anything organic or natural-sounding

---

### CINEMATIC / DRAMATIC

**Default Energy:** Low-medium — tension-forward, slow build
**Default BPM:** 60–75 — or tempo-free for ambient passages
**Default Instrumentation:** Orchestral strings (sustained), low brass undercurrent, sparse piano, distant percussion suggesting weight and scale. Subtle electronic texture optional.
**Mood Range:** Tension / foreboding / grandeur / anticipation / melancholy at scale
**Structure:** Slow build with emotional arc. Gentle swells. No full resolution — tension maintained throughout.
**Avoid:** Triumphant resolution, upbeat or hopeful tone, lyrics, jazz or lofi elements, anything that breaks cinematic register

---

### FANTASY / RPG

**Default Energy:** Low-medium — magical, warm, adventurous undercurrent
**Default BPM:** 70–90
**Default Instrumentation:** Orchestral strings, harp, soft flute or oboe, light choir texture (wordless), delicate celesta or music box tones. Warm and rich.
**Mood Range:** Wonder / mystery / ancient magic / quiet adventure
**Structure:** Melodic theme with gentle development. Looping but with variation on each pass. Feels like a place, not a journey.
**Avoid:** Hard percussion, electronic elements, aggressive energy, anything that suggests combat or urgency

---

### SCI-FI / COSMIC

**Default Energy:** Ambient-low — vast, suspended, weightless
**Default BPM:** No discernible tempo — or very slow pulse 40–55
**Default Instrumentation:** Synthesizer pads (cold and evolving), subtle arpeggiated tones at very low frequency, processed choir at extreme distance, occasional single tone bell or chime suspended in reverb.
**Mood Range:** Vast / isolated / awe / suspended time / the scale of space
**Structure:** Long-form evolving texture. Very slow tonal shifts. Occasional single melodic element emerges and dissolves. No rhythm.
**Avoid:** Warmth, urgency, rhythm, anything earthbound, anything that feels small or intimate

---

### SLEEP / DREAMY

**Default Energy:** Ambient — near silence, pillow-soft
**Default BPM:** No discernible tempo
**Default Instrumentation:** Very soft synthesizer pads, slow-moving harmonic drones, occasional distant piano note dissolving in reverb, music box texture at extreme distance. Everything is soft-edged.
**Mood Range:** Dreaming / floating / safe / dissolving into sleep
**Structure:** Borderless — no discernible beginning or end. Tonal drifting. Nothing that triggers alertness.
**Avoid:** Rhythm of any kind, sudden changes, anything with attack, bright tones, melody that demands attention

---

### RAIN / STORM

**Default Energy:** Ambient — the rain is the texture
**Default BPM:** No discernible tempo
**Default Instrumentation:** Synthesizer pads under rain ambience (rain is primary texture not music), occasional low piano chord dissolving completely in reverb, distant thunder as low rumble. Minimal.
**Mood Range:** Shelter / introspection / melancholy / the peace of watching rain from inside
**Structure:** Rain ambience as primary layer. Music is secondary support. Very minimal melodic presence if any.
**Avoid:** Bright tones, upbeat elements, rhythm, anything that competes with the natural rain texture

---

### FOREST / NATURE

**Default Energy:** Ambient — the forest breathes
**Default BPM:** No discernible tempo
**Default Instrumentation:** Synthesizer drones tuned to natural harmonics, light acoustic guitar at extreme distance and reverb, occasional wind chime tone dissolving immediately, natural ambience textures underneath.
**Mood Range:** Ancient / peaceful / alive / the deep quiet of old growth
**Structure:** Continuous evolving texture. Very slow harmonic movement. No melody that pulls attention.
**Avoid:** Electronic elements, urban sounds, rhythm, anything that feels modern or constructed

---

### MEDITATION / MINDFULNESS

**Default Energy:** Ambient — deliberate, intentional silence as much as sound
**Default BPM:** No tempo — or single slow pulse at 40–50 BPM like a heartbeat
**Default Instrumentation:** Singing bowls (tuned), Tibetan or crystal bowl resonance, single sustained note on strings or synthesizer, occasional bell tone with very long decay. Intentional silence between elements.
**Mood Range:** Present / still / open / the space between thoughts
**Structure:** Space and silence are structural elements. Notes and tones emerge, sustain, and dissolve completely before the next. No rush. No fill.
**Avoid:** Density, constant sound, anything that fills silence, rhythm, melody, anything that suggests urgency or motion

---

### SYNTHWAVE / RETROWAVE

**Default Energy:** Medium — driving but hypnotic, not aggressive
**Default BPM:** 100–120
**Default Instrumentation:** Synthesizer arpeggios, gated reverb drums, bass synth, lead synth with slow attack, occasional saxophone or electric guitar texture. All analog-flavored.
**Mood Range:** Nostalgic / driving / neon-lit / 80s forward motion / cinematic night
**Structure:** Verse-chorus feel even without lyrics — build and release, return to main theme. Consistent groove.
**Avoid:** Acoustic instruments, organic textures, anything pre-80s, anything overly modern or digitally clean

---

### DARK ELECTRONIC

**Default Energy:** Low-medium — industrial pulse, controlled tension
**Default BPM:** 80–100 — or slow industrial 60–75
**Default Instrumentation:** Industrial synthesizer textures, heavy sub-bass, metallic percussion at low volume, processed mechanical sounds as rhythmic elements. Cold and controlled.
**Mood Range:** Industrial / controlled threat / machinery / underground / the hum of systems
**Structure:** Rhythmic pulse as foundation. Slow textural development. No melodic resolution — tension maintained.
**Avoid:** Warmth, organic elements, acoustic instruments, anything hopeful, anything that reduces tension

---

### EPIC ORCHESTRAL

**Default Energy:** Medium — building, vast, never fully releasing
**Default BPM:** 60–80 — slow and weighty
**Default Instrumentation:** Full orchestral strings (sustained and bowed), low brass (horns and trombones), choir (wordless, distant), timpani and percussion for weight, occasional solo instrument (cello, French horn) for emotional focus.
**Mood Range:** Scale / weight / ancient grandeur / the tension before something enormous / awe without triumph
**Structure:** Slow build with multiple waves. Each wave slightly larger than the last. No full resolution — always something more beyond the horizon.
**Avoid:** Upbeat or triumphant resolution, modern electronic elements unless specifically directed, anything small-scale or intimate, lyrics

---

### PEACEFUL CLASSICAL / PIANO

**Default Energy:** Low — intimate, still, unhurried
**Default BPM:** 60–75 — breathing tempo
**Default Instrumentation:** Solo piano (primary), optional light string accompaniment at very low volume, silence as instrument. Clean acoustic recording quality — no heavy reverb.
**Mood Range:** Contemplative / tender / suspended time / the beauty of an empty room
**Structure:** Through-composed feel — not looping, evolving. Gentle melodic development that never demands emotional response. Music as presence.
**Avoid:** Drama, large dynamics, percussion, electronic elements, anything that interrupts the intimacy of a single instrument in a quiet room

---

## Production Brief Integration (Track A Only)

The `music direction` block in the production brief contains:

```
PRIMARY MOOD: [single primary emotional target]
SUPPORTING MOOD: [secondary emotional layer — optional]
AVOID MOOD: [moods that would conflict with the video]
ENERGY LEVEL: [ambient / low / gentle / moderate]
GENRE NOTES: [any video-specific genre shift within the channel framework]
ARC: [how the music should evolve over the video — e.g. "builds slightly in middle third, returns to quiet for outro"]
```

Agent reads this block, merges with channel framework defaults above, and constructs the Stable Audio 2.5 prompt.

**Conflict rule:** If production brief energy level conflicts with channel framework (e.g. brief says moderate but framework is dark ambient), agent uses the lower energy level and notes the conflict in the session log.

---

## Short Format Music (Track A, long+short)

The short uses the long video's generated music track — trimmed, not regenerated.

Trimming logic:
- Agent identifies the most emotionally engaging 60–90 seconds from the full track
- Prefers the opening section (already tuned as the hook)
- Fades in from 0 if not already faded — no abrupt start
- Fades out with a 3-second fade at the end
- No re-generation — reuse only
