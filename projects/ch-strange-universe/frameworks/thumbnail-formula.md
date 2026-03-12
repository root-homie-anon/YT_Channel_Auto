# Thumbnail Formula — [Channel Name]

> This file defines how the `@video-compiler` agent generates thumbnail images for this channel.
> Thumbnails are generated via Nano Banana 2 (gemini-3.1-flash-image-preview) — not pulled from video frames.
> Fill in all bracketed sections before the first production run.
> The agent reads this file alongside the production brief at thumbnail generation time.

---

## Channel Thumbnail Identity

**Visual style:** [e.g. cinematic and dark, bold and graphic, clean and minimal, illustrative]
**Color palette:** [define 2–3 primary colors used consistently across all thumbnails — creates channel recognition]
**Complementary pair:** [the high-contrast color combination used for text + background — e.g. deep blue + bright amber]
**Faceless strategy:** [since this is a faceless channel, define the emotional substitute — e.g. dramatic illustrated scenes, symbolic objects, visual contradiction, concept-made-concrete]
**Consistency rule:** [one design element that appears in every thumbnail to build channel recognition — e.g. always a single focal point left-aligned, always dark vignette border, always same text treatment]

---

## Thumbnail Specs

- **Dimensions:** 1280×720px (16:9)
- **Resolution:** 2K minimum, 4K preferred for NB2 output
- **File format:** PNG
- **Safe zones:** Keep all key elements and text away from bottom-right corner (YouTube timestamp overlay)
- **Mobile check:** All elements must read clearly at 320px width — if text or focal point is unclear at postage-stamp size, redesign
- **Contrast minimum:** 4.5:1 ratio between text and background — NB2 should be prompted explicitly for high contrast

---

## Core Design Principles

**1. Single focal point**
One dominant subject. Everything else supports it. A cluttered thumbnail reads as low quality and loses the click.

**2. High contrast is mandatory**
YouTube's algorithm updated in 2025 to penalize low-contrast designs in recommendations. The agent must explicitly request high contrast in every NB2 prompt. Use the grayscale test mentally — if the main subject and text aren't clearly readable in black and white, the contrast is insufficient.

**3. Text overlay rules**
- Maximum 3–4 words
- Bold weight only — thin text is invisible on mobile
- Text covers 25–35% of the image area
- Text must COMPLEMENT the title, not repeat it — it adds a layer the title doesn't
- Never place text bottom-right (timestamp zone)
- Preferred zones: top, left-center, or bold center depending on composition
- NB2 handles text rendering natively — specify exact words, placement zone, and style in the prompt

**4. Emotional hook**
The thumbnail creates one specific feeling in under 2 seconds. Define the target emotion before building the prompt. Options: curiosity, shock, desire, urgency, unease, awe. One emotion. Not multiple.

**5. The title-thumbnail pairing**
Read the selected title before generating. The thumbnail raises a question or creates tension that the title either names or sharpens. They are one message split across two elements. If they're saying the same thing, one of them is redundant.

---

## Faceless Emotional Substitutes

Since this channel has no presenter face, use these techniques to create emotional connection:

**Dramatic scene** — place the viewer inside a visually tense or striking moment. The scene implies a story.
**Symbolic object** — a single object that carries strong emotional or cultural weight. Specificity matters — not "a coin" but "a Roman denarius."
**Visual contradiction** — two elements that shouldn't coexist in the same frame. Creates instant cognitive tension.
**Concept made concrete** — abstract ideas rendered as physical, tangible visuals. "Economic collapse" → crumbling architecture. "Manipulation" → strings on a figure.
**Scale contrast** — small subject against overwhelming environment, or vice versa. Creates awe or unease.

---

## NB2 Prompt Construction

The agent builds every thumbnail prompt in this structure. NB2 auto-enhances prompts but needs strong directional input.

### Prompt Template

```
[SUBJECT]: [Specific primary subject from thumbnail direction in production brief]
[SCENE/CONTEXT]: [Environment, setting, or visual context]
[MOOD]: [Emotional tone — e.g. ominous, epic, melancholic, tense]
[COMPOSITION]: [Focal point placement, framing — e.g. "subject center-left, negative space right for text"]
[STYLE]: [Visual style from channel identity — e.g. cinematic photorealism, dark oil painting, graphic illustration]
[COLOR]: [Channel palette + complementary contrast pair]
[CONTRAST]: Explicitly high contrast. Bold color separation between foreground and background.
[TEXT]: "[Exact 3–4 word overlay]" — [placement zone] — bold weight, [color] on [contrasting background]
[AVOID]: [Faces unless intentional, busy backgrounds, multiple competing subjects, soft contrast, watermarks]
[SPECS]: 16:9 aspect ratio, 4K resolution, thumbnail-optimized, mobile-readable
```

### Prompt Construction Rules
- Be specific about the subject — NB2's search grounding means named subjects (real places, historical objects, specific concepts) render more accurately than vague descriptions
- Always include contrast and mobile-readability as explicit requirements
- Always specify text overlay words, placement, and style — NB2 renders text natively and accurately
- State the emotional target — NB2 responds to mood direction
- Include what to avoid — negative prompting prevents generic outputs

### Example Prompt (illustrative)
```
Ancient Roman forum in ruins at dusk, golden hour light casting long shadows across broken columns.
Composition: ruins center-left, dark sky fills upper-right for text placement.
Mood: ominous and melancholic, sense of lost greatness.
Style: cinematic photorealism, rich warm and cool contrast.
Colors: deep teal sky against amber stonework, high contrast separation.
Explicitly high contrast between foreground ruins and sky background.
Text overlay: "WHY IT COLLAPSED" — upper-right zone — bold white on dark sky, large and legible.
Avoid: people, crowds, bright cheerful tones, busy middle ground, soft edges.
16:9 aspect ratio, 4K resolution, thumbnail-optimized, reads clearly at mobile size.
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
- Same channel palette and style
- Text overlay: same rules, adapted for vertical composition
- Safe zone: avoid bottom area (YouTube Shorts UI elements)
- Prompt construction: same template, specify 9:16 and vertical composition explicitly
