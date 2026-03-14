# Title Formula — Liminal Synth

---

## Channel Title Identity

**Title style:** Evocative and atmospheric — titles name a place, state, or feeling, not a genre label
**Tone:** Quiet, cinematic, poetic without being pretentious. Reads like a film title or album name.
**Avoid:** Genre labels as the lead word ("Synthwave Mix", "Dark Ambient"), duration in title, all-caps, exclamation marks, emojis, "relaxing", "chill", "lo-fi", generic mood words
**Character target:** 30–50 characters — short titles stand out in feeds
**Hard cap:** 60 characters

---

## Title Patterns

The pipeline selects from these patterns using keywords extracted from the image and music prompts. Each pattern produces a different feel — variety across productions keeps the channel fresh.

| Pattern | Structure | Example |
|---------|-----------|---------|
| Place Name | [Invented Location] | Neon Corridor 7 |
| State + Location | [Mood] [Environment] | Silent Rooftop |
| The + Abstract | The [Abstract Noun] | The Drift |
| Compound Concept | [Noun] + [Noun] | Chrome Horizon |
| Action Fragment | [Verb-ing] [Preposition] [Place] | Descending Through Fog |
| Single Word | [Evocative Word] | Afterglow |
| Colon Split | [Place/Concept]: [Qualifier] | Terminal: Night Shift |

---

## Keyword Pools

Titles are built by combining words from these pools. The pipeline extracts relevant keywords from the production's image prompts and selects from the matching pool.

### Environment Words
rooftop, corridor, tunnel, overpass, skyline, tower, platform, terminal, transit, station, edge, threshold, district, sector, level, block, grid, stack, spine, crossing

### Atmosphere Words
silent, distant, hollow, fading, drifting, suspended, dissolving, ascending, descending, hovering, flickering, pulsing, humming, receding, vanishing

### Abstract Nouns
drift, signal, static, pulse, bloom, decay, trace, echo, haze, glow, current, threshold, meridian, vertex, orbit, wavelength, frequency, resonance

### Color/Light Words
neon, chrome, violet, cyan, phosphor, mercury, tungsten, halogen, plasma, prismatic

---

## Scene Name Pool

For multi-segment videos, each segment gets a scene name used in chapter markers. Draw from this pool sequentially, do not repeat within a single production:

Neon Drift, Chrome Horizon, Vapor Circuit, Midnight Signal, Pulse Decay, Static Bloom, Phantom Grid, Hollow Frequency, Afterglow, Terminal Haze, Silhouette, Data Rain, Ghost Protocol, Solar Wind, Echo Chamber, Dead Channel, Null Zone, Sine Wave, Phase Shift, Dark Matter, Sublevel, Upper Reach, Iron Sky, Glass Spine, Cold Front

---

## Construction Rules

- Never start with a genre name (electronic, synthwave, ambient)
- Never include duration (1 hour, 3h, 180 min)
- Never include "mix", "compilation", "playlist", "session"
- Prefer 2–4 word titles — brevity is strength
- One title per production — no candidate voting needed
- Title should feel like it could be an album track name
- If the image prompt references a specific environment, lean into that

---

## What This Formula Does NOT Do

- No thumbnail pairing — music-only channels have no thumbnails
- No production brief integration — titles derive from prompt keywords
- No candidate voting — pipeline selects algorithmically from patterns
