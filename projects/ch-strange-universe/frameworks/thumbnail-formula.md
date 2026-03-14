# Strange Universe — Thumbnail Formula

## Overview
Three content pillars, each with its own visual medium, artifact set, stamp color, and typography rules. All prompts follow the same structure: medium description → subject → artifacts → stamp block → output spec.

System instruction lives at: `projects/ch-strange-universe/system-instructions/thumbnail.md`

---

## Pillar 1 — Surveillance (UAP/UFO)

**Flavors:** VHS Camcorder / CCTV / Military NVG
**Stamp color:** Red
**Stamp words:** UNIDENTIFIED / CLASSIFIED / UNKNOWN

### Prompt Template
```
Generate a YouTube thumbnail image. A replicated [FLAVOR] capturing [SUBJECT]. [FLAVOR ARTIFACTS]. The atmosphere is dark, deeply unsettling, and raises more questions than it answers — something is visible that should not exist.

In the lower three-quarters of the frame, a large bold distressed red rubber stamp impression reads "[STAMP WORD]" — thick stencil letterforms spanning nearly the full width, rough edges, ink bleed, uneven pressure, physically stamped onto the footage frame. Directly below in smaller weight, the same red rubber stamp treatment reads "[2-3 CONTEXT WORDS]" — subordinate but legible at mobile size.

16:9 aspect ratio, 4K resolution.
```

### Flavor Tokens
Replace `[FLAVOR]` and `[FLAVOR ARTIFACTS]` with the appropriate pair:

**VHS:**
- Token: `VHS camcorder found footage still frame`
- Artifacts: `Horizontal tracking lines, tape noise, color bleed, faded desaturated palette, handheld camera shake, small camcorder HUD showing REC indicator and timecode in corner.`

**CCTV:**
- Token: `CCTV security camera still frame`
- Artifacts: `Fisheye lens distortion, authentic timestamp overlay in corner, low resolution grain, desaturated green-grey palette, compression artifacts, static vignette.`

**NVG:**
- Token: `military night vision footage still frame`
- Artifacts: `Green phosphor monochrome, grain, bloom on light sources, vignette edges, crosshair reticle visible, classified surveillance atmosphere.`

---

## Pillar 2 — Archaeological (Ancient History / Annunaki)

**Flavor:** Aged expedition photograph
**Stamp color:** Amber/yellow
**Stamp words:** REDACTED / FORBIDDEN / SUPPRESSED

### Prompt Template
```
Generate a YouTube thumbnail image. A replicated aged archival photograph found in a sealed expedition file. The image depicts [SUBJECT]. Authentic aging artifacts — faded sepia-to-monochrome, grain, edge vignette, uneven exposure, creases and foxing at corners. The atmosphere is ancient, forbidden, and deeply unsettling — this documents something that rewrites history.

In the lower three-quarters of the frame, a large bold amber-yellow rubber stamp impression reads "[STAMP WORD]" — heavy slab serif letterforms spanning nearly the full width, pressed with a nearly-dry ink pad, ink starvation leaving gaps and erosion across the letterforms, uneven pressure, edges rough and crumbling. Directly below in smaller weight, the same rubber stamp treatment reads "[2-3 CONTEXT WORDS]" — subordinate, same ink starvation and wear, legible at mobile size.

16:9 aspect ratio, 4K resolution.
```

---

## Pillar 3 — Technical (Suppressed Technology)

**Flavor:** Declassified blueprint / leaked schematic
**Stamp color:** White
**Stamp words:** CLASSIFIED / LEAKED / RESTRICTED

### Prompt Template
```
Generate a YouTube thumbnail image. A replicated classified engineering schematic recovered from a suppressed government research file. The image depicts [SUBJECT]. Authentic document artifacts — technical grid lines, annotation marks, dimension callouts, faint classification headers, subtle paper aging. The atmosphere is clinical, secretive, and deeply unsettling — this document describes technology that should not exist.

In the lower three-quarters of the frame, a large bold white rubber stamp impression reads "[STAMP WORD]" — heavy clean sans-serif letterforms spanning nearly the full width, crisp with a thin outer stroke and tight drop shadow separating it from the document background. Directly below in smaller weight, the same white treatment reads "[2-3 CONTEXT WORDS]" — subordinate, sharp, legible at mobile size.

16:9 aspect ratio, 4K resolution.
```

---

## Variable Slots (all pillars)

| Variable | Description | Example |
|---|---|---|
| `[SUBJECT]` | What the image depicts — be specific, ground it visually | `a large dark craft hovering low over a Texas highway at night` |
| `[STAMP WORD]` | Single classification word from approved bank | `CLASSIFIED` |
| `[2-3 CONTEXT WORDS]` | Subordinate curiosity hook — lowercase | `annunaki origin evidence` |

---

## Stamp Word Selection Guide

Choose based on the specific angle of the video, not just the pillar:

- **UNIDENTIFIED / UNKNOWN** — object or entity cannot be explained
- **CLASSIFIED / RESTRICTED** — information was deliberately hidden
- **REDACTED / SUPPRESSED** — evidence was actively removed or buried
- **FORBIDDEN / LEAKED** — knowledge that crossed a line someone enforced
