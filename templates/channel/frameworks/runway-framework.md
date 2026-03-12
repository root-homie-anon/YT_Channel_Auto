# Runway ML Animation Framework — Music-Only Channels

> This file defines how `@asset-producer` generates animated video clips from static images
> using Runway ML's Gen-3 Alpha Turbo image-to-video API.
> **Music-only channels only** — long/short narrated formats use Ken Burns (FFmpeg zoompan) instead.
> Each generated image is animated into a short looping clip. These clips are concatenated
> and looped to fill the full music duration during compilation.

---

## When Animation Applies

| Channel Format | Motion Source | This Framework |
|----------------|-------------|----------------|
| `long` | Ken Burns via FFmpeg (zoompan) | NOT used |
| `short` | Ken Burns via FFmpeg (zoompan) | NOT used |
| `long+short` | Ken Burns via FFmpeg (zoompan) | NOT used |
| `music-only` | Runway ML image-to-video | **USED** |

---

## Animation Philosophy

Music-only videos have no voiceover — the visuals ARE the content alongside the music.
Static images are not sufficient. The animation must:

- Feel like a living, breathing scene — not a slideshow with motion added
- Loop seamlessly — viewers watch for 30+ minutes, any jarring loop point breaks the trance
- Match the music's energy — slow music = slow motion, ambient = nearly imperceptible movement
- Never distract from the music — the animation supports atmosphere, it doesn't perform

---

## Runway ML Settings

**Model:** `gen3a_turbo`
**Duration:** 4 seconds per clip (Runway minimum for loopable output)
**Input:** Base64 data URI of the generated Flux image
**Output:** MP4 clip downloaded and saved locally

---

## Prompt Construction

The animation prompt describes ONLY the motion — not the scene (the image already defines that).

### Template
```
[MOTION TYPE]: [Primary movement — what moves and how]
[SPEED]: [Imperceptible / very slow / slow / gentle — never fast]
[LOOP INTENT]: Seamless loop — motion must flow continuously without visible reset
[CAMERA]: [Static / very slow push / very slow pull — camera movement is optional and always subtle]
[AVOID]: Fast motion, abrupt changes, new elements appearing, camera shake, dramatic transitions
```

### Motion by Image Category

These defaults come from the image framework's `Animation Intent` fields:

| Category | Primary Motion | Secondary Motion |
|----------|---------------|-----------------|
| Lofi Study | Head bob, steam rise | Rain streaks, light pulse |
| Jazzhop Cafe | Musician sway, instrument motion | Candle flicker, smoke curl |
| Chillhop Bedroom | Record spin | Fairy light pulse, curtain sway |
| Dark Ambient | Residual light pulse (very slow) | Dust/ash drift |
| Cinematic | Storm clouds, lightning | Grass/wheat wave |
| Fantasy RPG | Orb pulse, particle emission | Candle flicker |
| Sci-Fi Cosmic | Nebula color shift | Star streak |
| Sleep Dreamy | Curtain billow | Cloud drift, star twinkle |
| Rain Storm | Rain fall, puddle ripples | Tree sway, distant lightning |
| Forest Nature | Spore/mote drift | Leaf movement |
| Meditation | Smoke curl, flame flicker | Water ripple |
| Synthwave | Grid line motion | Neon light pulse |
| Dark Electronic | Steam vent cycle | Indicator light blink |
| Epic Orchestral | Storm movement, lightning | Vegetation, debris lift |
| Peaceful Classical | Dust mote drift | Light shift |

---

## Compilation Integration

After all animation clips are generated:

1. FFmpeg concatenates all clips in sequence
2. The concatenated sequence is looped (`-stream_loop`) to fill the full music track duration
3. Music audio is mapped directly — no mixing needed (no VO in music-only)
4. Crossfade transitions between clips are optional — Runway output often loops cleanly enough

---

## Fallback Behavior

If Runway ML generation fails for any image:
- Log warning, skip that clip
- If ALL clips fail, fall back to static image with Ken Burns (same as long/short)
- Never block the pipeline on animation failure
