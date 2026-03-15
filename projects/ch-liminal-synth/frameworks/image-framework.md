# Image Framework — Liminal Synth
# Location: projects/ch-liminal-synth/frameworks/image-framework.md
# Read by @asset-producer via .claude/skills/flux-image-producer.md before every image generation task.

---

## 1. Channel Visual Identity

Liminal Synth exists in a permanent midnight — a vast, indifferent megacity where infrastructure dwarfs human presence and neon light bleeds into atmospheric haze. The visual world draws from Japanese megacity anime aesthetics, desaturated sci-fi noir cinematography, rain-soaked cyberpunk urbanism, neon-dense vertical cityscapes, and dystopian stack-city architecture. Every image occupies the space between — between human and environment, between presence and absence, between now and some unspecified future that already feels like the past.

The viewer is always slightly outside the scene. Never safe, never threatened — just witnessing. The city does not acknowledge the figures within it. Scale, density, and light are the primary characters. Human presence is rare, anonymous, and small.

---

## 2. Color Palette

True black is the permanent dark base. It never rotates. The three accent colors rotate roles across images per the Master Rotation Sequence in section 8.

| Name | Hex | Base Role |
|------|-----|-----------|
| True Black | `#000000` | Permanent dark base — shadows, sky, ground. Never rotates. |
| Violet | `#3D1566` | Atmosphere / depth / mid-tones |
| Electric Purple | `#7B2FBE` | Atmosphere reinforcement / secondary glow |
| Cyan | `#00F0FF` | Lighting / holographics / edge details |
| Magenta | `#FF2D9B` | Signage / advertisements / accent bleeds |

**Rotation rule:** Violet, Cyan, and Magenta rotate across three roles — Atmosphere, Primary Light, and Signage — per the sequence in section 8. `#000000` never moves. `#7B2FBE` is used as an atmosphere reinforcement when violet holds the atmosphere slot.

---

## 3. Visual References

These are aesthetic directions Flux recognises deeply. Include at least two per prompt — they carry lighting logic, architectural language, and atmosphere that would take 50 extra words to describe manually.

| Aesthetic | What it contributes |
|-----------|-------------------|
| Japanese megacity decay | Urban decay at scale, infrastructure density, neon kanji, wet streets built for millions but feeling empty |
| Sci-fi noir negative space | Extreme negative space, colour as atmosphere, lonely figures at impossible scale, cold violet sky |
| Rain-soaked cyberpunk urbanism | Rain-soaked city from above, architectural cross-sections, city as organism, rain diffusion through layered light |
| Neon-dense vertical cityscape | Vertical density, holographic advertising, neon bleeding into everything, underground infrastructure |
| Dystopian stack-city architecture | Stack cities, perpetual night, brutalist towers wrapped in light, overpass and platform architecture |

**Usage rule:** Always pair aesthetics intentionally. Lead with the one that contributes the *environment*, follow with the one that contributes the *atmosphere or lighting quality*.

---

## 4. Rendering Style Rules

**With a subject present → Photorealistic**
- Shot on Sony A7R IV
- Lens varies by perspective slot (see section 8)
- Fine grain, slight underexposure
- High shadow detail, desaturated midtones

**Without a subject → Concept art**
- Clean precise linework
- Architectural illustration quality
- Matte surface finish
- No photographic grain or lens simulation language

Never mix rendering styles within the same image. The rule is absolute.

---

## 5. Environments

These four environments cycle across the image set. No single environment repeats on consecutive images.

| Environment | Notes |
|-------------|-------|
| Tower blocks and skyscrapers | Wide establishing or tight facade — vary per framing slot |
| Bridges and overpasses | Underside geometry, span length, structural detail |
| Underground tunnels and subways | Vanishing point, tiled walls, ceiling infrastructure |
| Rooftops and elevated platforms | Low camera across surface toward skyline, or high looking down |

---

## 6. Atmosphere Rotation

Variable across the image set. Never repeat the same condition on consecutive images.

| Condition | Description |
|-----------|-------------|
| Heavy fog | Volumetric haze, city dissolving at midground |
| Light rain mist | Fine precipitation catching neon light, surfaces wet but not flooded |
| Clear cold air | Hard edges, sharp architecture, maximum city depth visible |
| Smog diffusion | Amber-tinted haze low between towers, city glow from below |
| Rain-slicked dry | Wet ground reflections, no active rain, surfaces mirror the city above |

---

## 7. Subject Definitions

Subjects appear rarely — environments dominate. When a subject is present the image is photorealistic. Four subject types rotate:

| Subject | Description |
|---------|-------------|
| Hooded figure | Anonymous, gender neutral, hood casting face in shadow |
| Suited figure | Sharp urban silhouette, no readable face |
| Astronaut figure | Full suit, reflective helmet catching city light |
| Silhouette only | No readable clothing or features — pure dark shape against light |

---

## 8. Master Rotation Sequence

The agent follows this table sequentially. Each new image with a subject advances one slot. Environment-only images consume a color slot but not a perspective slot. After slot 8 the sequence resets to slot 1.

| Slot | Atmosphere | Primary Light | Signage | Camera Perspective | Lens | Subject | Orientation |
|------|-----------|---------------|---------|-------------------|------|---------|-------------|
| 1 | Violet `#3D1566` | Cyan `#00F0FF` | Magenta `#FF2D9B` | Rule of thirds — offset left | 35mm f/1.8 | Hooded figure | Back to camera |
| 2 | Cyan `#00F0FF` | Magenta `#FF2D9B` | Violet `#3D1566` | Low angle looking up | 24mm f/2.8 | Suited figure | Side profile |
| 3 | Magenta `#FF2D9B` | Violet `#3D1566` | Cyan `#00F0FF` | Extreme foreground — close up | 85mm f/1.4 | Hooded figure | Facing camera |
| 4 | Violet `#3D1566` | Magenta `#FF2D9B` | Cyan `#00F0FF` | High angle looking down | 28mm f/2.0 | Silhouette only | Back to camera |
| 5 | Cyan `#00F0FF` | Violet `#3D1566` | Magenta `#FF2D9B` | Over the shoulder | 35mm f/1.8 | Astronaut figure | Side profile |
| 6 | Magenta `#FF2D9B` | Cyan `#00F0FF` | Violet `#3D1566` | Dutch angle — slight tilt | 35mm f/2.0 | Suited figure | Back to camera |
| 7 | Violet `#3D1566` | Cyan `#00F0FF` | Magenta `#FF2D9B` | Rule of thirds — offset right | 50mm f/1.4 | Hooded figure | Side profile |
| 8 | Cyan `#00F0FF` | Magenta `#FF2D9B` | Violet `#3D1566` | Extreme foreground — close up | 85mm f/1.4 | Silhouette only | Facing camera |

---

## 9. Prompt Construction Template

### With subject (photorealistic)
```
Photorealistic [SUBJECT] [ORIENTATION] [CAMERA PERSPECTIVE], [SCALE in frame],
[AESTHETIC 1] environment, [AESTHETIC 2] [atmosphere/lighting quality],
[ATMOSPHERE COLOR role hex] atmospheric [condition],
[PRIMARY LIGHT COLOR role hex] [light source and surface],
[SIGNAGE COLOR role hex] [signage/holographic detail],
true black shadows and base #000000,
shot on Sony A7R IV [LENS from rotation slot], fine grain, slight underexposure,
[ATMOSPHERE CONDITION from section 6], [mood close], cinematic 2.39:1
```

### Without subject (concept art)
```
Concept art architectural illustration of [ENVIRONMENT] at midnight,
[AESTHETIC 1] aesthetic, [AESTHETIC 2] [composition quality],
[ATMOSPHERE COLOR role hex] atmospheric [condition],
[PRIMARY LIGHT COLOR role hex] [light source and surface],
[SIGNAGE COLOR role hex] [signage/holographic detail],
true black sky and ground #000000,
clean precise linework, architectural illustration quality, matte surface finish,
[ATMOSPHERE CONDITION from section 6], [mood close], cinematic 2.39:1
```

---

## 10. Assembled Prompt Examples

### Example A — Slot 1, Rooftop, with subject
```
Photorealistic hooded figure standing at the edge of a sci-fi noir megacity rooftop
at midnight, positioned left third of frame back to camera, right two thirds open city
dropping away into Japanese megacity decay tower density below, violet atmospheric haze filling
the city depth #3D1566, cyan rooftop edge and infrastructure lighting #00F0FF, magenta
holographic signage cascading down towers in the distance #FF2D9B, true black sky #000000,
shot on Sony A7R IV 35mm f/1.8, fine grain, slight underexposure, light rain mist,
figure 12% of frame, cinematic 2.39:1
```

### Example B — Environment only, Tower Blocks, concept art
```
Concept art architectural illustration of a Japanese megacity canyon at midnight,
rain-soaked cyberpunk urbanism aesthetic, dense vertical towers with sci-fi noir negative
space composition, violet atmospheric haze filling the city depth #3D1566, cyan holographic
advertising bleeding into low fog #00F0FF, magenta kanji signage cascading down tower
faces #FF2D9B, true black sky and ground #000000, clean precise linework, architectural
illustration quality, matte surface finish, heavy fog, city as living organism,
silent and immense, cinematic 2.39:1
```

### Example C — Slot 3, Bridge, with subject (facing camera close up)
```
Photorealistic hooded figure facing camera in extreme foreground, face partially obscured
by hood casting deep shadow, rain-soaked cyberpunk urbanism rain mist on skin and jacket surface,
dystopian stack-city overpass infrastructure filling the background compressed behind
the figure, magenta atmospheric haze in the city depth #FF2D9B, violet bridge structural
lighting behind the figure #3D1566, cyan neon signage bleeding in from the edges #00F0FF,
true black shadows on face and hood #000000, shot on Sony A7R IV 85mm f/1.4, shallow
depth of field, city background softly compressed, rain-slicked dry, intimate and
unknowable, cinematic 2.39:1
```

---

## 11. Quality Gates

Before approving any generated image for the video set:

- [ ] Matches the channel visual identity — midnight, indifferent city, anonymous presence
- [ ] True black `#000000` is the darkest element in the frame
- [ ] Correct color rotation slot applied — three accent colors in correct roles
- [ ] Rendering style matches the rule — photorealistic with subject, concept art without
- [ ] Correct camera perspective and lens for the rotation slot
- [ ] At least two aesthetic direction references visible in the output
- [ ] No warm tones, no golden hour, no identifiable faces
- [ ] Atmosphere condition does not repeat from the previous image
- [ ] Image could belong in the same visual universe as every other image in the set

If two or more gates fail — regenerate with a revised prompt. Log what changed.

---

## 12. What This Channel Is Not

The agent uses this list to catch drift before calling the API.

- Not warm, golden, or sunlit — ever
- Not anime or cel-shaded
- Not chaotic or cluttered — always considered and still
- Not identifiable real-world locations
- Not populated — crowds never appear
- Not hopeful — awe yes, optimism no
- Not colorful in a playful sense — color is atmospheric, not decorative
