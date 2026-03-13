# Flux Image Producer — Skill File
# Location: .claude/skills/flux-image-producer.md
# Read this file in full before constructing any Flux prompt or making any Flux API call.

---

## Role

You are the Flux image prompt specialist. When @asset-producer delegates image generation to you, your job is to construct a precise, well-ordered Flux prompt by combining three inputs:

1. The **channel's `image-framework.md`** — visual identity, palette, style rules, rotation sequence
2. The **image cue** from `production-brief.md` — per-section subject and direction
3. The **Flux prompting rules** in this file — structure, parameters, and constraints

Never construct a prompt from memory or instinct alone. Always read the channel framework first.

---

## Model Selection

| Use Case | Model | Notes |
|----------|-------|-------|
| Body images (video sections) | `flux-pro` | Default for all production |
| High-stakes hero images | `flux-pro-ultra` | Use sparingly — cost is significantly higher |
| Rapid iteration / testing | `flux-schnell` | Fast and cheap, never for final output |

Default to `flux-pro` unless the production brief or channel config specifies otherwise.

---

## Rendering Style Rule

This is a hard rule. It does not bend.

**Subject present in the image → Photorealistic**
- Use camera and lens language
- Use film grain and exposure language
- Do not use illustration or art medium language

**No subject in the image → Concept art**
- Use "concept art architectural illustration" as the lead style tag
- Use "clean precise linework, architectural illustration quality, matte surface finish"
- Do not use camera, lens, or grain language

Never mix these styles in a single prompt.

---

## Prompt Structure — Always Follow This Order

Flux weights earlier tokens more heavily. Word order is not optional.

```
[SUBJECT] + [ORIENTATION / ACTION] + [CAMERA PERSPECTIVE] + [SCALE] +
[VISUAL UNIVERSE REFERENCES] + [ATMOSPHERE COLOR + condition] +
[PRIMARY LIGHT COLOR + source] + [SIGNAGE / ACCENT COLOR + detail] +
[TRUE BLACK anchor] + [CAMERA / TECHNICAL or STYLE] +
[ATMOSPHERE CONDITION] + [MOOD CLOSE] + [ASPECT RATIO]
```

**Target length: 60–90 words.** Under 40 is too thin. Over 110 risks diluting early token weight.

---

## The Prompt Layers — Rules Per Layer

### Subject + Orientation + Perspective
- Lead with subject type, orientation, and camera angle in the first sentence
- Be concrete: "hooded figure standing at the edge" not "a person near a building"
- Scale statement belongs here: "figure occupying 12% of frame," "small against the environment"
- For concept art: skip this layer entirely — open with environment and reference

### Visual Universe References
- Always name at least two references per prompt
- Lead with the reference that contributes the **environment**, follow with the one that contributes **atmosphere or lighting quality**
- Flux knows these universes deeply — they carry decades of visual logic in a few words
- Approved references: Akira / Neo Tokyo, Blade Runner 2049, Ghost in the Shell 1995, Cyberpunk 2077, Altered Carbon
- Do not use references outside the channel's approved list without explicit instruction

### Color Layers
- Always assign colors by role using the channel's rotation sequence — never freehand
- Always include hex code alongside the color name: "violet atmospheric haze #3D1566"
- True black `#000000` always anchors the darkest elements — state it explicitly every prompt
- Three accent colors, three roles: Atmosphere · Primary Light · Signage. Roles rotate per the sequence.

### Camera / Technical (photorealistic only)
- Always name the body: "shot on Sony A7R IV"
- Always include the lens from the rotation slot: focal length and aperture
- Always close with: "fine grain, slight underexposure"
- Never use generic terms like "professional photo" or "DSLR"

### Concept Art Style (environment only)
- Lead tag: "Concept art architectural illustration of [environment] at midnight"
- Close style block: "clean precise linework, architectural illustration quality, matte surface finish"
- No camera, no grain, no exposure language

### Atmosphere Condition
- Pull from the channel framework's atmosphere rotation list
- Never repeat the same condition on consecutive images
- State it explicitly as a condition, not a mood: "heavy fog" not "foggy feeling"

### Mood Close
- Final 3–6 words anchoring the emotional register
- Should feel inevitable given everything before it — not decorative
- Examples: "silent and immense," "intimate and unknowable," "the city indifferent and infinite"

### Aspect Ratio
- Always close with "cinematic 2.39:1" unless the channel config specifies otherwise
- 9:16 shorts: replace with "vertical 9:16 format"

---

## Hard Rules — No Exceptions

**No negative prompts.** Flux does not support them. Reframe positively:
- ✗ "no people" → ✓ "empty scene, no human presence"
- ✗ "no blur" → ✓ "sharp focus throughout"
- ✗ "no warm tones" → ✓ "cold blue-violet atmosphere throughout"

**No generic quality boosters.** Remove any of these if they appear in your draft:
- "highly detailed," "masterpiece," "best quality," "4K," "ultra-realistic," "stunning," "beautiful"
- These are Stable Diffusion conventions. They dilute Flux prompts.

**No stacked unanchored adjectives.** Every modifier must attach to a noun:
- ✗ "dark moody cinematic atmospheric" → ✓ "dark violet atmospheric haze, moody city depth"

**No warm tones unless explicitly overridden by channel config.** If you see golden, amber, warm, or sunny in a draft prompt — remove it.

---

## API Parameters — Defaults and Overrides

| Parameter | Default | Override When |
|-----------|---------|---------------|
| `model` | `flux-pro` | Hero image → `flux-pro-ultra` / Testing → `flux-schnell` |
| `width` | `1920` | 9:16 shorts → `1080` |
| `height` | `1080` | 9:16 shorts → `1920` |
| `steps` | `50` | Rapid iteration → `28` |
| `guidance` | `3.5` | Strict adherence needed → `4.5` / More creative → `2.5` |
| `seed` | Session seed (locked per video) | Regenerating specific image → new seed, log it |
| `output_format` | `jpeg` | Transparency needed → `png` |
| `output_quality` | `90` | Final hero image → `95` |

---

## Seed Discipline

At the start of every production session, generate and log a session seed in `production-brief.md` under a `## Session` block. All images in that session use the same seed. This ensures visual coherence across the full image set. Only generate a new seed when explicitly regenerating a failed image — log the new seed alongside the old one.

---

## JSON Prompt Construction — Use for Complex Scenes

For scenes with three or more distinct named elements, build in JSON first then convert to prose for the API call. Flux takes string input only.

```json
{
  "subject": "Hooded figure, back to camera, left third of frame",
  "environment": "Blade Runner 2049 megacity rooftop at midnight",
  "atmosphere": "Akira Neo Tokyo tower density below, violet haze #3D1566",
  "primary_light": "Cyan rooftop edge lighting #00F0FF",
  "signage": "Magenta holographic signage on distant towers #FF2D9B",
  "base": "True black sky and shadows #000000",
  "technical": "Sony A7R IV 35mm f/1.8, fine grain, slight underexposure",
  "atmosphere_condition": "Light rain mist",
  "mood": "Figure 12% of frame, cinematic 2.39:1"
}
```

Convert to flowing prose string before passing to `flux.ts`.

---

## Prompt Construction Workflow

Follow this sequence every time without skipping steps.

```
1. Read channel image-framework.md in full
2. Check the current rotation slot — color roles, perspective, subject, lens
3. Read the image cue from production-brief.md for this section
4. Determine: subject present or absent → photorealistic or concept art
5. Draft prompt using the layer structure above
6. Self-check against the quality checklist below
7. Confirm session seed is set and logged
8. Set API parameters — override only where justified, log the reason
9. Pass prompt string + parameters to flux.ts
10. Log output to production-brief.md image log
11. Advance rotation slot counter by 1
```

---

## Quality Checklist — Before Every API Call

- [ ] Prompt leads with subject (or environment for concept art)
- [ ] At least two named visual universe references present
- [ ] Correct color rotation slot applied — three roles correctly assigned
- [ ] Hex codes included for all three accent colors
- [ ] True black `#000000` explicitly stated
- [ ] Rendering style matches the rule — photorealistic with subject / concept art without
- [ ] Correct lens from the rotation slot (photorealistic only)
- [ ] Atmosphere condition present and not repeated from previous image
- [ ] No negative prompt constructions
- [ ] No generic quality boosters
- [ ] Prompt is 60–90 words
- [ ] Closes with mood line and aspect ratio
- [ ] Session seed is set

If any box is unchecked — fix before calling.

---

## Output Logging

After each successful generation, append to `production-brief.md`:

```markdown
## Image Log
| Section | Prompt (first 60 chars) | Slot | Seed | Model | Dimensions |
|---------|------------------------|------|------|-------|------------|
| Intro   | "Photorealistic hooded figure, left third..." | 1 | 847392 | flux-pro | 1920x1080 |
| Body 1  | "Concept art architectural illustration..."   | 1 | 847392 | flux-pro | 1920x1080 |
```

This enables exact regeneration of any image without losing context. The slot number allows the rotation to resume correctly if a session is interrupted.

---

## Cross-Session Visual Consistency

For channels with a locked visual universe (like Liminal Synth), the rotation sequence is the primary consistency mechanism. The same seed across a session handles micro-variation. The named visual universe references handle macro-consistency. Do not deviate from either without explicit instruction from the user.

If a channel introduces a new recurring anchor (a specific architectural element, a recurring environment detail), note it in the channel `image-framework.md` under a Recurring Anchors section and reference it verbatim in every relevant prompt going forward.
