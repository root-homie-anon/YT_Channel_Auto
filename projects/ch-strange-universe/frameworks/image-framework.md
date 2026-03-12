# Image Framework — Strange Universe

> This file defines how `@asset-producer` generates images via Flux for Strange Universe videos.
> It is a style guide and prompt construction system for the UFO/UAP investigation niche.
> The agent reads this file alongside the production brief at image generation time.

---

## Channel Visual Identity

**Style:** Mike Mignola comic book illustration — heavy black ink shadows, bold geometric shapes, minimal detail with maximum atmosphere. Strong silhouettes, dramatic high-contrast lighting, flat color fields with limited palette. The look of Hellboy meets declassified Cold War files.
**Mood:** Atmospheric tension with undercurrents of awe and unease. Gothic weight. Every frame should feel like a panel from a graphic novel about things the government doesn't want you to see.
**Realism standard:** Stylized, not photorealistic. No little green men. No classic flying saucers. If a craft appears, it should be an ambiguous shape — orbs, tic-tac forms, dark triangles — rendered in Mignola's heavy shadow style.

---

## Color Palette

**Primary:** Heavy black (#0d0d0d), deep blood red (#8b1a1a), cold stone blue (#3a5f7a)
**Accent:** Sickly amber (#c4841d), pale cold light (#d4dde6), muted military green (#4a5d3a)
**Atmosphere:** Flat color fields dominated by black. Limited palette per image — 2-3 colors max plus black. Large areas of solid shadow. Color is used sparingly for impact.
**Avoid:** Gradients, soft blending, photorealistic rendering, bright saturated colors, busy detailed backgrounds, anything that looks AI-generated or smooth

---

## Scene Categories

The agent selects the appropriate category based on the IMAGE CUE from the script. Multiple categories can be used within a single video.

---

### NIGHT SKY / ENCOUNTER

**Scene:** Vast dark sky over open terrain — desert, ocean, or military airfield. A single anomalous light or object at distance, ambiguous and unsettling. Stars visible. The landscape is empty and exposed.

**Subject A:** The anomalous object — a distant glowing orb, a dark triangular silhouette against stars, or an indistinct luminous shape. Always at distance, never close-up. The ambiguity IS the point.

**Subject B:** The ground environment — military runway lights in a line, ocean surface reflecting moonlight, or desert terrain stretching to the horizon. Human infrastructure that provides scale.

**Palette:** Near-black sky, cold blue horizon line, single warm or white light from the anomalous object, faint amber from ground-level human lighting

**Avoid:** Close-up alien craft with visible details, beam-of-light abduction scenes, flying saucers, anything that looks like a movie poster

---

### MILITARY / GOVERNMENT

**Scene:** Austere institutional interiors or exteriors — Pentagon corridors, military briefing rooms, aircraft carrier flight decks at dusk, classified document storage facilities, radar operation centers. Everything is utilitarian, imposing, and cold.

**Subject A:** The institutional environment itself — long corridors with harsh fluorescent lighting, banks of radar screens with green sweeps, stacks of folders stamped CLASSIFIED, or an empty briefing room with a single document on the table.

**Subject B:** Atmospheric detail — harsh shadow from a single overhead light, dust particles in a shaft of fluorescent light, condensation on a cold metal surface, a partially redacted document visible in foreground.

**Palette:** Cold fluorescent white, military grey-green, steel blue, deep shadow. Single warm accent from a desk lamp or instrument panel.

**Avoid:** Visible faces (faceless channel), modern tech aesthetics, clean corporate design, anything that looks civilian or comfortable

---

### DECLASSIFIED DOCUMENT / ARCHIVAL

**Scene:** Close-up or medium shot of documents, photographs, or archival materials — as if the viewer is looking at classified files spread on a desk under a single lamp. Vintage feel where appropriate (Cold War era, 1940s–1980s).

**Subject A:** The document or photograph itself — partially visible text with key phrases readable, redaction bars (black strikethrough over text), official stamps and seals, aged paper texture, typewriter font.

**Subject B:** The environment — dark desk surface, single warm desk lamp casting strong directional shadow, edge of a coffee cup or pen in the periphery. The surrounding darkness implies secrecy.

**Palette:** Warm amber from the lamp on cream/aged paper, deep shadow everywhere else, occasional cold blue from a secondary light source

**Avoid:** Modern digital screens, clean bright lighting, readable full documents (suggest content, don't reproduce it), anything that looks staged or fake

---

### COCKPIT / RADAR / INSTRUMENT

**Scene:** Military cockpit interior or radar operation station — instrument panels glowing in a dark environment. The perspective of the person who saw something they can't explain.

**Subject A:** Instrument displays — radar screen with a tracked object blip, FLIR/infrared display showing a heat signature, HUD overlay with targeting information, gauges and readouts.

**Subject B:** The view beyond — through a cockpit canopy showing dark sky or ocean, through a window showing nothing but darkness. The contrast between the data on the instruments and the vast unknown outside.

**Palette:** Green radar glow, amber instrument lighting, deep black cockpit interior, cold blue exterior visible through canopy

**Avoid:** Realistic military insignia or unit markings (avoid IP issues), visible pilot faces, sci-fi cockpit designs, anything that looks like a video game

---

### LANDSCAPE / LOCATION

**Scene:** The real-world location where the event occurred — rendered atmospherically. Rendlesham Forest at night with fog. The New Mexico desert under a stormy sky. The Pacific Ocean surface at twilight. Antarctica's ice shelf under aurora.

**Subject A:** The landscape itself — vast, empty, and atmospheric. The location should feel both beautiful and ominous, as if something happened here that changed everything.

**Subject B:** A single small human element that provides scale — a distant military vehicle, a lone figure silhouetted at the horizon, a guard tower, a radio antenna. Something that makes the landscape feel enormous.

**Palette:** Driven by the specific location, but always desaturated and moody. Cool tones dominate. If warm tones appear (sunset, fire), they're isolated and dramatic.

**Avoid:** Tourist-photo compositions, bright cheerful landscapes, populated scenes, anything that diminishes the sense of isolation and scale

---

### WITNESS / SILHOUETTE

**Scene:** A single human figure, always in silhouette or deep shadow — never a visible face. The witness, the whistleblower, the person who knows more than they can say.

**Subject A:** Silhouetted figure — standing at a window looking out at the sky, seated at a desk in shadow with a lamp behind them, walking through a dark corridor with light at the far end.

**Subject B:** What they're looking at or walking toward — a distant light in the sky through the window, a stack of documents on the desk, the light at the end of the corridor implying something beyond.

**Palette:** High contrast — the figure is near-black silhouette against a lighter background element. Cold blue or warm amber background depending on the emotional context.

**Avoid:** Visible facial features, multiple people, anything that identifies a specific real person, casual or domestic settings

---

## Flux Prompt Construction Template

Every image prompt is built in this order:

```
[subject and scene from IMAGE CUE], in the style of Mike Mignola Hellboy comics, heavy black ink shadows dominating the frame, bold flat geometric shapes, stark high-contrast lighting with deep blacks and limited color, graphic novel panel composition, hand-inked illustration aesthetic, no visible faces, no text
```

### Style Tag Rules

- The style tag is the PRIMARY driver of visual consistency. It must be strong enough to override Flux's default photorealistic tendency.
- Lead with "in the style of Mike Mignola Hellboy comics" — this is the most reliable style anchor for Flux.
- Emphasize "heavy black ink shadows dominating the frame" — without this, Flux will produce soft, evenly-lit images.
- Always end with "no visible faces, no text" — Flux generates bad faces and gibberish text.
- Keep the full prompt (cue + style tag) under 60 words total. Flux degrades with long prompts.

### What Flux Cannot Do (never include these in prompts)

- **Screens or UI:** No radar displays, FLIR footage, infrared views, HUD overlays, instrument panels with readable data, computer monitors showing content
- **Readable text:** No headlines, document text, stamps, labels, dates, Cyrillic, or any specific words
- **Split/composite views:** No side-by-side comparisons, picture-in-picture, data overlays on scenes
- **Specific real people or insignia:** No named individuals, military unit patches, government seals

If the image cue describes any of the above, the agent must **reinterpret** the cue into a pure scene: translate what the instrument/document/screen DEPICTS into the actual physical scene it represents.

---

## Per-Video Customization

The production brief's image direction block can override or extend any defaults above. The brief provides:
- Per-section image cues with specific visual descriptions
- Era/setting overrides (e.g., "1940s New Mexico" vs "contemporary Pentagon")
- Specific motifs tied to the case being investigated

The agent always reads the production brief image direction FIRST, then fills gaps with this framework's defaults.

---

## Short Format (9:16) Adaptation

For teaser/short videos, the same visual style applies with these adjustments:
- Reframe existing 16:9 images to 9:16 vertical crop
- Ensure the primary subject remains centered after crop
- If cropping loses critical composition elements, generate a new vertical-native image using the same prompt with `9:16 vertical aspect ratio` specified
- Maintain the same dark, atmospheric, cinematic quality
