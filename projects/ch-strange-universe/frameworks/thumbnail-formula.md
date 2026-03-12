# Thumbnail Formula — Strange Universe

> This file defines how the `@video-compiler` agent generates thumbnail images for this channel.
> Thumbnails are generated via Nano Banana 2 (gemini-3.1-flash-image-preview) — not pulled from video frames.
> The agent reads this file alongside the production brief at thumbnail generation time.

---

## Channel Thumbnail Identity

**Visual style:** Dark cinematic photorealism — every thumbnail should look like a frame from a high-production investigation documentary. Moody, atmospheric, grounded. Not cartoonish, not sci-fi, not campy.
**Color palette:** Deep navy (#0a1628) and near-black (#0d0d0d) backgrounds with cold steel blue (#4a6fa5) midtones. High-contrast accent elements in amber (#c4841d) or cold white (#e8eef2).
**Complementary pair:** Deep navy/black background + bright amber or cold white text and focal elements. This pairing creates maximum readability and feeds-standout against YouTube's white/light grey interface.
**Faceless strategy:** Since this is a faceless channel, emotional connection comes from dramatic scene composition, symbolic objects that carry investigative weight (redacted documents, radar screens, military silhouettes), visual contradiction (an empty sky where something should be), and scale contrast (a lone figure against a vast dark landscape or massive military installation).
**Consistency rule:** Every thumbnail uses a dark vignette border that fades to near-black at the edges, a single dominant focal point positioned left-of-center, and text (when used) in the upper-right quadrant. This creates instant channel recognition in the feed.

---

## Thumbnail Specs

- **Dimensions:** 1280x720px (16:9)
- **Resolution:** 2K minimum, 4K preferred for NB2 output
- **File format:** PNG
- **Safe zones:** Keep all key elements and text away from bottom-right corner (YouTube timestamp overlay)
- **Mobile check:** All elements must read clearly at 320px width — if text or focal point is unclear at postage-stamp size, redesign
- **Contrast minimum:** 4.5:1 ratio between text and background — NB2 should be prompted explicitly for high contrast

---

## Core Design Principles

**1. Single focal point**
One dominant subject. Everything else supports it. A cluttered thumbnail reads as low quality and loses the click. For UFO content, the focal point is often: a distant anomalous light in a dark sky, a redacted document with a single visible phrase, a military silhouette looking at something off-frame, or an empty landscape where something should be.

**2. High contrast is mandatory**
YouTube's algorithm updated in 2025 to penalize low-contrast designs in recommendations. The agent must explicitly request high contrast in every NB2 prompt. The dark palette of this channel demands bright focal elements — an amber-lit object, a glowing orb, white text on dark sky. Use the grayscale test mentally — if the main subject and text aren't clearly readable in black and white, the contrast is insufficient.

**3. Text overlay rules**
- Maximum 3–4 words
- Ultra-bold weight only — thin text is invisible on mobile
- Text covers 40–50% of the image width — it is the DOMINANT visual element, not a small accent
- Text must COMPLEMENT the title, not repeat it — it adds a layer the title doesn't (e.g., title says "The Pentagon's Secret UFO Program," thumbnail text says "EXPOSED" or "22 MILLION")
- Never place text bottom-right (timestamp zone)
- Preferred zone: lower-left, massive, integrated into the scene composition
- NB2 handles text rendering natively — describe text emphatically as "ENORMOUS", "CRITICAL", "dominant" in the prompt
- Text color: pure bright white with subtle shadow for depth on the dark backgrounds this channel uses
- The text should feel monumental — like a movie poster title, not a small label

**4. Emotional hook**
The thumbnail creates one specific feeling in under 2 seconds. For Strange Universe, the target emotions rotate between:
- **Curiosity** — "what is that?" (an ambiguous object, a partially revealed document)
- **Unease** — "something is wrong here" (empty spaces that should have something, redacted text, military tension)
- **Awe** — "this is bigger than I thought" (scale contrast, vast landscapes, enormous structures)

One emotion per thumbnail. Not multiple.

**5. The title-thumbnail pairing**
Read the selected title before generating. The thumbnail raises a question or creates tension that the title either names or sharpens. They are one message split across two elements. If they're saying the same thing, one of them is redundant.

---

## Faceless Emotional Substitutes

Since this channel has no presenter face, use these techniques to create emotional connection:

**Dramatic scene** — a dark military runway at night with a single distant light in the sky. The viewer is placed inside the scene.
**Symbolic object** — a declassified document with redaction bars and a single visible phrase. A radar screen with an anomalous blip. A military badge next to a sealed envelope.
**Visual contradiction** — an empty, clear sky over a military base where multiple witnesses reported seeing something. A normal-looking ocean surface with FLIR data overlaid showing a heat signature.
**Concept made concrete** — "government cover-up" rendered as a hand placing a CLASSIFIED stamp on a photograph of lights in the sky. "Disclosure" rendered as a vault door cracked open with light spilling out.
**Scale contrast** — a lone silhouetted figure standing at the edge of a military hangar, looking up at something enormous just out of frame. A tiny research station against an overwhelming Antarctic landscape.

---

## NB2 Prompt Construction

The agent builds every thumbnail prompt in this structure. NB2 auto-enhances prompts but needs strong directional input.

### Prompt Template

The prompt is written as natural flowing paragraphs, not bracketed fields. Gemini responds better to descriptive prose than structured tags. The prompt has four sections:

**1. SCENE** — Paint an epic, vivid, layered composition with three layers of depth:
- Foreground: dark silhouetted element (equipment, rubble, archway)
- Midground: the primary subject (figure, structure, object) at dramatic scale
- Background: atmospheric element (light source, sky, haze)
Include volumetric fog between layers. Emphasize scale contrast — the scene should feel massive.

**2. TEXT** — The single most important element. Must be described as:
- ENORMOUS bold text, 40-50% of image width
- Positioned lower-left of the image
- Ultra-bold weight, wide letter tracking, pure bright white with shadow
- Integrated into the composition, not overlaid — it should feel like part of the scene
- Use the word "CRITICAL" when instructing about text to signal importance to the model

**3. STYLE** — Color palette, lighting, mood:
- Deep navy/black shadows, rich accent colors (blue, amber, red, purple)
- Volumetric light rays, rim lighting on key elements
- Film grain, cinematic photorealism, high production value
- State the emotional target explicitly

**4. CONSTRAINTS** — Technical specs and avoid list:
- 16:9, 4K, high contrast, mobile-readable at 320px
- Avoid: cartoonish, bright cheerful, cluttered, soft contrast, faces, watermarks

### Prompt Construction Rules
- Write in natural descriptive prose, NOT bracketed [FIELD] tags — Gemini generates better images from prose
- Be specific: named locations, concrete objects, specific materials beat vague descriptions
- Text is the #1 priority — describe it emphatically and repeatedly if needed
- Three-layer depth is non-negotiable — flat compositions look amateur at thumbnail size
- Always include an avoid list — prevents generic outputs

### Example Prompt (Strange Universe style)
```
Epic cinematic scene: A massive Soviet underground bunker stretching into darkness. In the center, a towering steel blast door cracked open with eerie cold blue light spilling through the gap. Soviet military equipment and control panels line the walls, indicator lights glowing red. A lone silhouetted figure in a military coat stands before the enormous door, dwarfed by its scale.
The scene has dramatic depth with three layers: dark silhouetted equipment in the foreground, the massive blast door and figure in the midground, and mysterious blue light flooding from behind the door in the background.
Volumetric fog and atmospheric haze between layers creates cinematic depth.
Scale contrast: the bunker feels enormous and overwhelming, the human figure is tiny against the massive door.

CRITICAL TEXT REQUIREMENT: The words "SOVIET UFO SECRETS" must be rendered as ENORMOUS bold text across the lower-left portion of the image.
The text must be the single most dominant visual element, covering approximately 40-50% of the image width.
Text style: ultra-bold, wide tracking, pure bright white with subtle shadow for depth. The letters should feel monumental and powerful.
The text must be integrated into the scene composition — it should feel like it belongs in the image, not pasted on top.

Color palette: deep navy blues, rich cold blues, and near-black shadows. Accent lighting in red from control panels and cold electric blue from behind the door.
Style: dark cinematic photorealism with film grain, dramatic atmospheric lighting, high production value.
Mood: Nuclear dread and cosmic mystery — something beyond human understanding is behind that door.
Lighting: dramatic volumetric rays of blue light through the door gap, red indicator glow on walls, strong contrast between lit and shadow areas.

Image must have extremely high contrast — bright elements pop against deep dark backgrounds.
Must be clearly readable and impactful at small thumbnail size (320px width).
16:9 aspect ratio, 4K resolution.

Avoid: cartoonish or campy elements, flying saucers, alien creatures, bright cheerful colors, busy cluttered compositions, soft low-contrast look, visible human faces, watermarks, cheap stock photo aesthetic. The image should look like a frame from a high-budget documentary or cinematic trailer.
```

---

## Thumbnail Generation Sequence

1. Agent reads `production-brief.md` thumbnail direction block
2. Agent reads the finalized title (for pairing alignment)
3. Agent identifies the emotional target and pairing pattern
4. Agent constructs the NB2 prompt using the template above
5. Agent calls `nanobana.ts` with the prompt, aspect ratio 16:9, resolution 4K
6. Output saved to session directory as `thumbnail.png`
7. Agent presents thumbnail at Telegram Checkpoint 2 alongside the final video

**Timing note:** Thumbnail generation runs in parallel with FFmpeg compilation — it does not need to wait for the compile to finish. Both can run simultaneously after the title is locked.

---

## Short-Format Thumbnail

For shorts (`teaser-formula.md` Mode A or B), generate a separate thumbnail:
- Aspect ratio: 9:16 vertical
- Same dark cinematic palette and style
- Text overlay: same rules, adapted for vertical composition (text centered upper-third)
- Safe zone: avoid bottom area (YouTube Shorts UI elements)
- Prompt construction: same template, specify 9:16 and vertical composition explicitly
- The short thumbnail can use a different concept than the long thumbnail — it should be optimized for the Shorts feed, which is a different browsing context
