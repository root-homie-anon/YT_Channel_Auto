# Image Framework — [CHANNEL NAME]
# Location: projects/ch-[name]/frameworks/image-framework.md
# This file is read by @content-strategist via the flux-image-producer skill when constructing image prompts.
# Fill in every section before the first production run. Incomplete sections produce inconsistent output.

---

## 1. Channel Visual Identity

One paragraph. Describe the overall visual world of this channel — what does every image feel like? What is the viewer's relationship to the scene? What emotional register does the imagery consistently occupy?

This is the north star. If a generated image doesn't feel like it belongs in this description, the prompt needs revision.

```
[WRITE YOUR VISUAL IDENTITY STATEMENT HERE]

Example (Liminal Synth):
Every image exists in a world after midnight — cities that never sleep but feel abandoned,
architecture that dwarfs the human figure, technology that glows with cold indifference.
The viewer is always slightly outside the scene, an observer rather than a participant.
The emotional register is melancholic awe: beautiful, vast, and quietly lonely.
```

---

## 2. Color Palette

The fixed color palette for this channel. All Flux prompts reference these hex values by name and code.
Flux follows hex values reliably — use them for every image, not approximate descriptions.

| Name | Hex | Usage |
|------|-----|-------|
| [PRIMARY DARK] | #000000 | Primary background, dominant shadows |
| [PRIMARY COLOR 1] | #000000 | Primary accent, hero elements |
| [PRIMARY COLOR 2] | #000000 | Secondary accent, supporting elements |
| [HIGHLIGHT] | #000000 | Rare highlight, point of maximum contrast |
| [NEUTRAL MID] | #000000 | Mid-tones, atmospheric haze, fog |

**Rules:**
- Always reference at least two palette colors in every prompt by name and hex
- Primary dark should dominate — it sets the channel's signature tone
- Highlight color used sparingly (one element per image maximum)

```
[FILL IN YOUR HEX TABLE ABOVE]
```

---

## 3. Style Modifiers

The fixed artistic and rendering style for this channel. These appear verbatim in every prompt — they define the visual medium and aesthetic movement.

**Primary style** (1–2 phrases, always included):
```
[e.g. "cinematic synthwave aesthetic, 35mm film grain"]
```

**Secondary style** (optional, used when primary needs reinforcement):
```
[e.g. "retro-futuristic illustration, matte painting quality"]
```

**Style reference artists or works** (optional, for agent context only — not always in prompt):
```
[e.g. "Syd Mead, Blade Runner production design, Simon Stålenhag"]
```

**What this channel's style is NOT** (helps the agent avoid drift):
```
[e.g. "Not anime, not cel-shaded, not watercolor, not warm or golden-toned"]
```

---

## 4. Camera & Technical Language

The fixed technical language that anchors this channel's imagery. Pull from this section verbatim for every prompt.

**Primary camera profile:**
```
[e.g. "Shot on Sony A7R IV, 35mm f/1.8, slight underexposure"]
```

**Lens character:**
```
[e.g. "anamorphic lens, subtle horizontal lens flare, 2.39:1 cinematic ratio"]
```

**Film / sensor quality:**
```
[e.g. "fine grain, desaturated midtones, high shadow detail"]
```

**For illustrated/painterly channels** (replace camera language with):
```
[e.g. "oil on textured panel, visible brushwork, matte surface"]
```

---

## 5. Lighting Direction

The channel's signature lighting approach. Be specific — lighting is the highest-leverage element in Flux.

**Primary light source:**
```
[e.g. "distant neon signage, cool blue-purple cast from above"]
```

**Secondary light source:**
```
[e.g. "faint warm amber from windows or screens, deep in the background"]
```

**Shadow treatment:**
```
[e.g. "deep, near-black shadows with soft edges — no hard shadow lines"]
```

**What to avoid:**
```
[e.g. "No golden hour, no warm sunlight, no high-key lighting"]
```

---

## 6. Composition Rules

How images are framed and composed for this channel. The agent uses these as defaults unless the image cue specifies otherwise.

**Default framing:**
```
[e.g. "wide establishing shot, subject occupies no more than 20% of frame"]
```

**Subject placement:**
```
[e.g. "rule of thirds — subject lower-left or lower-center, environment dominant"]
```

**Depth:**
```
[e.g. "strong foreground/midground/background separation — always three planes of depth"]
```

**Perspective:**
```
[e.g. "slightly low angle, looking up or across — never bird's eye"]
```

**Aspect ratio (body images):**
```
16:9 — 1920x1080px
```

---

## 7. Mood & Atmosphere Language

The emotional and atmospheric vocabulary for this channel. The agent pulls from this list when constructing the mood layer of every prompt.

**Core mood words** (always present in some form):
```
[e.g. melancholic, vast, liminal, suspended, solitary, electric, indifferent]
```

**Atmospheric conditions** (rotate across images to avoid repetition):
```
[e.g. "heavy fog," "light rain mist," "clear cold air," "ambient haze from city glow"]
```

**What to avoid:**
```
[e.g. "Not hopeful, not warm, not energetic, not chaotic — always quiet, always still"]
```

---

## 8. Recurring Anchors

Visual elements that appear across multiple videos to build channel identity. Reference these verbatim in every relevant prompt.

These are optional but highly recommended — they create the sense that all videos exist in the same visual universe.

| Anchor | Description | Frequency |
|--------|-------------|-----------|
| [ANCHOR NAME] | [Visual description — used verbatim in prompts] | Every video / Most videos / Occasionally |

```
[FILL IN YOUR RECURRING ANCHORS — OR DELETE THIS SECTION IF NOT USED]

Example (Liminal Synth):
| Brutalist architecture | "brutalist concrete towers, weathered and monolithic" | Every video |
| Lone figure | "solitary hooded figure, small against the environment" | Most videos |
| Neon infrastructure | "glowing neon signage reflected on wet surfaces" | Most videos |
```

---

## 9. Per-Section Prompt Modifiers

Some channels vary image style by video section type. Define section-level overrides here if needed.
Leave blank if the channel uses a consistent style across all sections.

| Section Type | Override / Additional Modifier |
|--------------|-------------------------------|
| Hook / Intro | [e.g. "tighter framing, more intense — medium shot rather than wide"] |
| Body sections | [Standard — no override, use defaults above] |
| Climax / Reveal | [e.g. "most dramatic composition, strongest contrast, hero color at full intensity"] |
| Outro | [e.g. "widest shot, most atmospheric, quietest mood"] |

---

## 10. Prompt Construction Template

The agent assembles prompts using this template. Variables in [brackets] are filled from the image cue and sections above.

```
[SUBJECT from image cue] + [ACTION/STATE from image cue], [PRIMARY STYLE MODIFIER], 
[CAMERA PROFILE], [LENS CHARACTER], [LIGHTING — primary source and quality], 
[COLOR — hex values from palette], [COMPOSITION — framing and placement], 
[ATMOSPHERIC CONDITION], [MOOD LANGUAGE]
```

**Assembled example (Liminal Synth — section: "The Abandoned Infrastructure"):**
```
A lone hooded figure standing at the base of a massive brutalist concrete overpass, 
motionless in falling rain, cinematic synthwave aesthetic, 35mm film grain, 
shot on Sony A7R IV 35mm f/1.8, anamorphic lens with subtle horizontal flare, 
single cold neon tube from above casting deep purple #1A0533 shadows, 
electric cyan #00F5FF reflected in rain-slicked pavement below, 
wide establishing shot, subject lower-center, strong three-plane depth, 
light rain mist, melancholic and vast
```

Word count: 72 — within target range.

---

## 11. Variation Strategy

To prevent visual monotony across a multi-image video set, the agent rotates these elements between images:

**Rotate atmospheric condition:** cycle through the list in section 7 — do not repeat the same condition on consecutive images.

**Rotate subject scale:** alternate between wide (figure small), medium (figure at 30–40% of frame), and detail (no figure, environment only).

**Rotate time of night:** if the channel's world is nocturnal, vary the implied hour — deep midnight feels different from 3am feels different from pre-dawn.

**Keep fixed across all images in one session:** style modifiers, camera profile, hex palette, recurring anchors.

---

## 12. Quality Gates

Before approving any generated image for inclusion in the video, check:

- [ ] Matches channel visual identity statement (section 1)
- [ ] Channel palette colors are visible and dominant
- [ ] No warm or golden tones (or whatever the channel's avoid list specifies)
- [ ] Style modifiers are consistent with other images in the set
- [ ] Composition follows section 6 defaults or justified override
- [ ] Image could plausibly be a frame from the same visual universe as all other images

If two or more boxes fail, regenerate with a revised prompt. Log what changed.
