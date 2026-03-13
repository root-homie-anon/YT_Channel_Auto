# Animation Framework — Liminal Synth
# Location: projects/ch-liminal-synth/frameworks/animation-framework.md
# Read by @asset-producer via .claude/skills/runway-animation-producer.md before every Runway Gen-4 call.

---

## Overview

This framework covers Track B (music-only) animation only. Track A (narrated) uses Ken Burns motion via FFmpeg — Runway is not called for narrated video production.

Every Flux image generated for a Track B session gets animated via Runway Gen-4 Turbo. The prompt describes a single motion concept and direction. The model reads the image and self-populates animation detail — lights, puddles, atmospheric elements, subject micro-movement — without being explicitly instructed.

Do not over-prompt. The model is smarter than the prompt.

---

## Core Principle

**One motion concept. One direction word. `loopable` as the closer.**

That is the entire prompt. Everything else is handled by the model reading the image.

Testing confirmed: minimal prompts outperform complex layered prompts on every image type. The model detects subject presence automatically and animates the most appropriate elements — neon pulse, puddle ripples, atmospheric haze, figure micro-movement — based on what exists in the image, not what you describe.

---

## Prompt Structure

```
[Single motion concept with direction word], loopable
```

**Target length: 6–12 words maximum.** If your prompt exceeds 12 words it is too long.

---

## Confirmed Motion Prompts — Approved for Production

These prompts are confirmed working from live testing on Liminal Synth images.

### Atmospheric
```
Atmospheric haze drifting across the city, loopable
```
```
City smog drifting slowly through the towers, loopable
```

### Rain
```
Rain falling through neon light, loopable
```
```
Fine rain falling through the street, loopable
```

### Steam / Ground Fog
```
Steam rising from the street surface, loopable
```
```
Ground fog drifting slowly forward, loopable
```

### Light
```
Neon light pulsing through the rain, loopable
```
```
Holographic light shifting across the scene, loopable
```

### Camera drift (intentional — slow ambient push)
```
Steam and ground fog rising slowly upward, loopable
```
Note: This prompt produces a subtle upward camera tilt alongside scene animation. Confirmed working and appropriate for Liminal Synth — reads as intentional cinematic movement under music.

---

## Subject Shots

No separate prompt structure needed. The model detects figure presence from the image and animates the subject appropriately alongside environmental motion. Use the same prompt structure — one motion concept relevant to the scene environment. The model handles the rest.

---

## Prompt Selection by Scene Type

| Scene | Recommended Prompt |
|-------|--------------------|
| Rooftop, clear atmosphere | `Atmospheric haze drifting across the city, loopable` |
| Rooftop, rain present | `Rain falling through neon light, loopable` |
| Street level | `Steam rising from the street surface, loopable` |
| Tunnel / underground | `Ground fog drifting slowly forward, loopable` |
| Tower facade | `Neon light pulsing through the rain, loopable` |
| Bridge / overpass | `Fine rain falling through the street, loopable` |
| Any scene with holograms | `Holographic light shifting across the scene, loopable` |

When in doubt — haze or rain. Both confirmed working across all image types.

---

## Production Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| `model` | `gen4_turbo` | Confirmed working — do not change |
| `duration` | `10` | Production clips. Testing used 4s — 10s gives cleaner loops |
| `ratio` | `1280:720` | 16:9 standard. Match source image |
| `seed` | Match Flux session seed | Lock per session for consistency |
| `promptImage` | Source Flux image path | Always required |
| `promptText` | Motion prompt string | 6–12 words maximum |

---

## Output Selection

Testing at 4 seconds produced 3 usable loops per generation set. Generate 3 clips per image minimum and select the strongest loop. At 10 seconds the selection quality will be higher.

Selection criteria:
- Loop cut is clean — end frame matches start frame closely
- Camera drift (if present) is slow and reads as intentional
- Model-populated detail (neon pulse, puddle ripples, figure breath) is visible but not distracting
- No artifacting on fine linework or repeated textures

---

## What Not To Do

- Do not describe the scene in the prompt — the image already does this
- Do not layer multiple motion types in one prompt — single concept only
- Do not use the static camera instruction — it doesn't reliably hold and fights the model
- Do not use long loop anchor phrases — `loopable` alone is sufficient
- Do not exceed 12 words — longer prompts lose coherence and reduce motion quality
- Do not specify intensity — the model calibrates this from the image

---

## Output Logging

After each session append to `production-brief.md`:

```markdown
## Animation Log
| Segment | Image | Prompt | Seed | Duration | Selected |
|---------|-------|--------|------|----------|---------|
| Seg 1 | rooftop-01.png | Atmospheric haze drifting across the city, loopable | 847392 | 10s | clip-2 |
```
