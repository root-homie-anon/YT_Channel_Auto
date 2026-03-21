# Image Framework — Music Only Channels

> This file defines how `@content-strategist` constructs image prompts for Track B (music-only) channel videos, and how the pipeline generates images via Flux.
> It is a lookup and construction system — read and build from it, do not interpret.
> Two inputs drive every generation: CATEGORY + UNIVERSE MODIFIER (optional).
> This file covers image generation only. Animation direction lives in `runway-framework.md`.

---

## How It Works

### Two-Input System

```
INPUT 1: Music Category  → defines scene, subjects, mood, palette, loop structure
INPUT 2: Universe Modifier (optional) → reshapes the world without changing the mood
```

The agent looks up both inputs, merges them using the Flux prompt template, and generates.
If no modifier is provided, the base category scene is used as-is.

### Compatibility Rules

- **Group 1** (Lofi / Study / Jazzhop) — all modifiers valid
- **Group 2** (Dark Ambient / Cinematic / Fantasy) — Group 2 modifiers only
- **Group 3** (Sleep / Nature / Meditation) — no modifiers, base scenes only
- **Group 4** (Synthwave / Electronic) — Group 4 modifiers only
- **Group 5** (Epic / Orchestral) — Group 5 modifiers only

If user provides an incompatible modifier, agent flags it and asks user to select a valid one.

### Fallback Logic

If user input does not exactly match a category name, agent matches to closest semantic equivalent:
- "study music" → Lofi Study
- "spooky" → Dark Ambient
- "sleeping" → Sleep / Dreamy
- "80s" → Synthwave / Retrowave
- "orchestra" → Epic Orchestral

If no match is found, agent presents the full category list and asks user to select.

### Core Rule — Mood Always Wins

The universe modifier changes the world. It never changes the emotional register.
Dark Ambient stays oppressive and ancient in every universe.
Lofi Study stays cozy and intimate in every universe.
If a modifier conflicts with a category's mood, the category mood overrides.

---

## Flux Prompt Construction Template

Every image prompt is built in this order:

```
[SUBJECT + SCENE]: [Subject A from category] in [base scene from category]
[WORLD CONTEXT]: [Environment substitutions from modifier — or base environment if no modifier]
[ART STYLE]: [Art style from modifier, or photorealistic if no modifier]
[MOOD + ATMOSPHERE]: [Emotional register from category — never changes]
[LIGHTING]: [Color shift from modifier applied over base category palette]
[TEXTURE + MATERIAL]: [Signature details from modifier]
[SUBJECT B]: [Subject B from category] recontextualized into [modifier environment]
[COMPOSITION]: Single focal point. Subject A dominant. Subject B supporting.
               Negative space where needed. Nothing competes with the primary subject.
[AVOID]: [Category avoid list + modifier incompatibilities]
[SPECS]: 16:9 aspect ratio, high detail, cinematic quality, optimized for video frame,
         loop-friendly composition — no hard edges at frame boundary
```

---

## Category Library

---

### GROUP 1 — Lofi / Study / Jazzhop

---

#### LOFI STUDY

**Scene:** Cozy room at night, single desk lamp, rain on window, books and coffee on desk, lived-in warmth

**Subject A:** Person at desk — slight head movement, fingers on keyboard, steam rising slowly from mug beside them
**Subject A Animation Intent:** Minimal cyclical movement — head bob, finger tap, steam rise and dissipate

**Subject B:** Rain streaking down the window, city lights blurred and soft beyond the glass
**Subject B Animation Intent:** Continuous rain streak, light blur pulses gently

**Loop Notes:** Rain loops naturally. Steam dissipates and resets invisibly. Person movement is minimal and cyclical. Nothing resets abruptly.

**Base Palette:** Warm amber, deep navy, soft cream, single warm light source

**Avoid:** Bright daylight, crowds, fast motion, corporate settings, harsh lighting, multiple light sources competing

---

#### JAZZHOP / CAFÉ

**Scene:** Dimly lit jazz café at night, warm pendant lights, small round tables, intimate and close

**Subject A:** Musician silhouette on small stage — subtle instrument movement, piano keys depressing, trumpet raised to lips
**Subject A Animation Intent:** Subtle performance movement, body sway, instrument motion

**Subject B:** Couple at table in soft focus, candle between them flickering, wisp of cigarette smoke curling upward
**Subject B Animation Intent:** Candle flicker on independent cycle, smoke curls and dissipates

**Loop Notes:** Candle flicker loops perfectly. Smoke dissipates and resets. Musician movement is subtle and cyclical.

**Base Palette:** Deep amber, warm brown, soft gold, pools of warm light in darkness

**Avoid:** Daytime, modern settings, sterile environments, bright overhead lighting, empty spaces

---

#### CHILLHOP / BEDROOM

**Scene:** Cluttered but cozy bedroom, fairy lights strung across ceiling, vinyl record spinning on player, soft evening light

**Subject A:** Record spinning on turntable, needle tracking the groove, subtle vibration in the tonearm
**Subject A Animation Intent:** Record spin is a perfect seamless loop, tonearm has micro-vibration

**Subject B:** Fairy lights gently pulsing, window showing soft night sky beyond sheer curtain
**Subject B Animation Intent:** Fairy lights pulse slowly on independent timers, curtain sways imperceptibly

**Loop Notes:** Record spin is a perfect loop. Fairy light pulse is slow and cyclical. Curtain movement is organic and continuous.

**Base Palette:** Warm rose, soft purple, cream white, gentle warm glow

**Avoid:** Harsh lighting, chaos, daylight, minimalism, empty clinical spaces

---

### GROUP 2 — Dark Ambient / Cinematic / Fantasy

---

#### DARK AMBIENT

**Scene:** Interior of a colossal derelict structure — impossibly large chamber, walls covered in dormant technological relief patterns, faint residual energy glow emanating from deep within the geometry. Everything is solid. Everything is ancient. Everything is still.

**Subject A:** A single massive architectural element center frame — dormant monolithic column, sealed vault door, or alien mechanism. Surface etched with intricate circuitry-like patterns. Faint pulse of residual light deep within the grooves, almost imperceptible.
**Subject A Animation Intent:** Residual light pulse is slow — one full cycle every 8–10 seconds. The structure itself never moves.

**Subject B:** Atmosphere — slow drifting particles of dust or ash through a single shaft of cold light from an unseen opening far above, settling on the ancient floor below
**Subject B Animation Intent:** Dust particles drift downward continuously. Light shaft has the faintest pulse. Nothing else moves.

**Loop Notes:** Dust drift is continuous and resets invisibly at the top of frame. Light pulse is so slow it has no perceivable loop point. Absolute stillness everywhere else.

**Base Palette:** Near black, cold slate, desaturated teal, single cold blue-white light source. Zero warmth anywhere.

**Avoid:** Humans, living creatures, warm colors, vegetation, anything organic, fast motion, modern recognizable technology, chaos, disorder. The structure is not ruined — it is dormant.

**Feel:** This structure existed before humanity. It is not abandoned — it is dormant. Something immense happened here and stopped.

---

#### CINEMATIC / DRAMATIC

**Scene:** Vast open landscape, storm approaching on the horizon, lone ancient structure or figure silhouetted at the midpoint, dramatic sky consuming the upper half of the frame

**Subject A:** Storm clouds rolling slowly across the sky, internal lightning illuminating the cloud mass from deep within, light shifting dramatically across the landscape as the front advances
**Subject A Animation Intent:** Cloud movement slow and continuous left to right. Lightning flashes random within cloud mass — unpredictable timing within a cycle.

**Subject B:** Foreground — tall grass or wheat field, slow wave motion moving left to right driven by the approaching wind
**Subject B Animation Intent:** Grass wave is perfectly cyclical, continuous, gentle escalation as storm approaches

**Loop Notes:** Cloud movement is continuous. Lightning is randomized within bounds. Grass wave is seamless loop. The lone structure never moves.

**Base Palette:** Deep amber break in clouds, bruised purple storm mass, storm grey foreground, dramatic contrast between light and dark

**Avoid:** Happy bright tones, suburban settings, anything mundane, multiple competing subjects, symmetrical compositions

---

#### FANTASY / RPG

**Scene:** Ancient torch-lit library or wizard's tower interior — soaring stone ceilings, floating candles at varying heights, spell books and scrolls, magical orbs on pedestals, deep shadows beyond the candlelight

**Subject A:** Magical orb or artifact center frame — slow pulsing inner glow, occasional spark or particle emission drifting outward and fading
**Subject A Animation Intent:** Orb pulse is slow and cyclical — 4–6 second cycle. Particle emission is occasional and organic. Orb itself does not move.

**Subject B:** Floating candles in background at varying depths, each flickering on its own independent cycle, soft shadows shifting on stone walls
**Subject B Animation Intent:** Each candle flickers independently — no two in sync. Shadow movement is organic consequence of flicker.

**Loop Notes:** Orb pulse is slow and cyclical. Candle flicker is natural and organic — no perceivable loop point. Particles emit and fade on organic timing.

**Base Palette:** Deep emerald, rich gold, midnight blue, warm candlelight amber, deep shadow

**Avoid:** Modern elements, electric lighting, anything tech or industrial, bright daylight, clean sterile surfaces

---

#### SCI-FI / COSMIC

**Scene:** Deep space observation deck — massive floor-to-ceiling window occupying the full frame, nebula or slowly rotating planet beyond, minimal clean interior in the foreground, absolute silence implied

**Subject A:** Nebula color shift or planet rotation beyond the window — imperceptibly slow, vast scale, gas clouds drifting in deep color gradients
**Subject A Animation Intent:** Planet rotation is too slow to perceive as motion — creates feeling of suspended time. Nebula color shift is gradual across the full runtime.

**Subject B:** Interior reflection on the glass — faint ghost of the room reflected in the window, occasional distant star streaking slowly past
**Subject B Animation Intent:** Star streak is slow and rare — one every 15–20 seconds. Reflection is static.

**Loop Notes:** Nebula/planet movement has no perceivable loop point within 30 seconds. Star streaks are randomized. The loop is invisible by design.

**Base Palette:** Deep black, electric violet, cool teal, soft white starlight, warm interior accent light

**Avoid:** Action, explosions, chaos, fast motion, warm colors, anything earthbound or terrestrial

---

### GROUP 3 — Sleep / Nature / Meditation

*No universe modifiers for this group. Base scenes only.*

---

#### SLEEP / DREAMY

**Scene:** Softly lit bedroom floating in impossible space — clouds drifting slowly past the window, stars visible beyond, the room is warm and slightly surreal, bed unmade, soft curtains billowing gently inward

**Subject A:** Curtains moving in a slow invisible breeze, soft fabric catching the faint starlight, movement unhurried and dreamlike
**Subject A Animation Intent:** Curtain billow is slow and perfectly cyclical. Fabric movement is soft — no sharp edges in the motion.

**Subject B:** Clouds drifting past the window from right to left, stars twinkling faintly beyond, the outside is impossible and beautiful
**Subject B Animation Intent:** Cloud drift is continuous and seamless. Star twinkle is subtle and individually randomized.

**Loop Notes:** Curtain billow is cyclical and resets invisibly. Cloud drift is seamless continuous. Star twinkle has no loop point.

**Base Palette:** Soft lavender, warm cream, pale silver moonlight, deep midnight blue beyond the window

**Avoid:** Harsh light, sharp edges, urgency, geometric patterns, people, technology, anything that implies waking life

---

#### RAIN / STORM

**Scene:** Looking outward from inside a covered porch or large window — full rainstorm in progress, puddles forming on stone or cobblestone below, trees bending gently in the wind, warm light source from within the building behind the viewer

**Subject A:** Rain falling continuously across the full frame — varying intensity, individual drops catching the light, puddle surfaces rippling with each impact
**Subject A Animation Intent:** Rain is continuous and seamless. Puddle ripples expand and fade on organic timing. Intensity has subtle variation.

**Subject B:** Trees in the mid-distance swaying gently — leaves catching what little light exists, occasional distant lightning deep in the clouds, very infrequent
**Subject B Animation Intent:** Tree sway is slow and cyclical. Lightning flash is rare and deep in clouds — diffuse glow not sharp bolt. Once every 20–30 seconds.

**Loop Notes:** Rain is a perfect continuous loop. Tree sway is organic and cyclical. Lightning is randomized and rare.

**Base Palette:** Cool grey, deep wet green, wet stone silver, warm amber glow from within the building

**Avoid:** Sunshine, bright colors, people in the rain, urban modernity, cheerful tones, anything that breaks the shelter-from-storm feeling

---

#### FOREST / NATURE

**Scene:** Ancient forest floor looking upward through a cathedral of massive old-growth trees — shafts of soft light filtering through the canopy, moss-covered ground, absolute stillness below, scale is overwhelming

**Subject A:** Light shafts through the canopy — shifting almost imperceptibly slowly, dust motes and spores drifting weightlessly within the beams
**Subject A Animation Intent:** Light shaft shift is too slow to perceive as movement. Spore and mote drift is continuous, weightless, resets invisibly at frame edge.

**Subject B:** Canopy leaves above catching a gentle breeze — slow movement rippling outward from a single point, individual leaves catching light
**Subject B Animation Intent:** Leaf movement is gentle and continuously variable. No hard repeating cycle — organic and alive.

**Loop Notes:** Light shaft movement has no perceivable loop point. Leaf movement is organic and continuous. Spore drift resets invisibly. The loop is hidden in the organic variation.

**Base Palette:** Deep forest green, warm golden light shafts, rich brown earth tones, soft filtered white where light breaks through

**Avoid:** Animals in motion, people, urban intrusion, heavy saturation, sharp geometric elements, anything that breaks the ancient stillness of the forest floor

---

#### MEDITATION / MINDFULNESS

**Scene:** Minimalist stone or wooden platform at the edge of still water — mountains or infinite horizon beyond, pre-dawn or post-sunset light, single candle or incense stick in the foreground, perfect reflection in the water below

**Subject A:** Candle flame or incense smoke in the foreground — slow deliberate movement, smoke curling upward in a single unbroken thread before dispersing
**Subject A Animation Intent:** Smoke curls upward continuously, thread breaks and resets invisibly. Flame flicker is very gentle — barely moving.

**Subject B:** Water surface — completely still with perfect mirror reflection of the mountains and sky. Single slow ripple from an unseen source expanding outward and fading completely before the next begins.
**Subject B Animation Intent:** Ripple expands fully, fades completely, long pause — 8–10 seconds of perfect stillness — then repeats. The stillness is as important as the ripple.

**Loop Notes:** Smoke is continuous and resets invisibly. Ripple has long intentional pauses — the loop uses stillness deliberately. Both are meditative and intentional.

**Base Palette:** Pre-dawn grey-blue, single warm light source from candle, muted earth tones, reflection mirrors the sky exactly

**Avoid:** Bright daylight, saturated color, multiple competing subjects, anything decorative, fast motion, anything that breaks the meditative stillness

---

### GROUP 4 — Synthwave / Electronic

---

#### SYNTHWAVE / RETROWAVE

**Scene:** Elevated highway or empty boulevard stretching to a perfect vanishing point at the horizon — neon grid lines on the road surface, massive retro-futuristic skyline on both sides, low-hanging full moon or sun on the horizon casting everything in pink and orange haze

**Subject A:** Road surface with neon grid lines moving continuously toward the viewer — the sensation of forward motion without a vehicle, subtle chromatic aberration on the grid line edges
**Subject A Animation Intent:** Grid line movement is a perfect seamless loop toward viewer. Speed is steady and hypnotic — not fast.

**Subject B:** Skyline buildings on both sides — windows lit in neon pink and blue, occasional slow-moving blimp or aircraft with blinking lights far above
**Subject B Animation Intent:** Building neon lights pulse slowly on independent timers. Aircraft blinks on its own cycle. Nothing moves fast.

**Loop Notes:** Road grid is a perfect seamless loop. Building light pulses are independent and organic. Aircraft blink is on its own slow cycle.

**Base Palette:** Hot pink, electric blue, deep purple, neon orange horizon, near-black sky, chromatic aberration on edges

**Avoid:** Daylight, organic natural elements, muted colors, anything soft or rounded, modern realistic architecture, warm earth tones

---

#### DARK ELECTRONIC

**Scene:** Brutalist underground facility or server room corridor — low red or cold blue emergency lighting only, massive banks of dormant machinery stretching into darkness, condensation on metal surfaces, steam venting from floor grates

**Subject A:** Steam venting from floor grates in the foreground — slow pressurized release, drifts upward and disperses into the darkness above
**Subject A Animation Intent:** Steam vent releases on a slow deliberate cycle. Pressure builds, releases, disperses, resets. 6–8 second cycle.

**Subject B:** Machinery banks on both sides — single row of indicator lights blinking on independent slow cycles, condensation droplets catching the emergency light as they form and fall
**Subject B Animation Intent:** Indicator lights blink independently — no two in sync, creating an organic non-repeating pattern. Droplets form slowly and fall.

**Loop Notes:** Steam vent cycle is deliberate and repeating. Indicator lights are independent and create an organic non-repeating feel. Droplets are continuous.

**Base Palette:** Deep crimson emergency light OR cold blue emergency light — channel picks one and stays consistent. Near black. Wet metal silver. Absolute darkness in the far distance.

**Avoid:** Warmth, organic elements, nature, anything decorative or soft, bright light sources, human presence

---

### GROUP 5 — Epic / Orchestral

---

#### EPIC ORCHESTRAL

**Scene:** Impossible scale — standing at the edge of a colossal cliff overlooking a vast ancient landscape. Enormous storm system moving across the horizon. Distant mountains half-consumed by clouds. Ruins of a massive ancient civilization visible far below in the valley. The viewer is small. Everything else is not.

**Subject A:** Storm system on the horizon — moving slowly left to right, internal lightning illuminating the cloud mass from within, light shifting dramatically across the landscape below as the front advances
**Subject A Animation Intent:** Cloud movement is slow and continuous. Internal lightning is random and unpredictable within a cycle — diffuse glow not sharp bolt. Light on landscape shifts as clouds move.

**Subject B:** Foreground cliff edge — wind-whipped sparse vegetation clinging to rock, loose debris and dust lifting off the edge and carried away into the void below
**Subject B Animation Intent:** Vegetation movement is perpetual and wind-driven. Debris lifts and carries away continuously. Both escalate subtly as storm approaches.

**Loop Notes:** Storm movement is continuous. Lightning is randomized. Vegetation is perpetual. The ruins below never move. The cliff never moves. The scale never changes.

**Base Palette:** Dramatic stormy grey-purple, deep amber where light breaks through clouds, near black shadows, single shaft of gold light illuminating the ruins below

**Avoid:** Small scale, intimate settings, warm cozy elements, modern structures, bright cheerful light, static flat compositions, anything that diminishes the sense of overwhelming scale

---

#### PEACEFUL CLASSICAL / PIANO

**Scene:** Grand but intimate concert hall or estate music room — completely empty, late afternoon light streaming through tall windows casting long golden rectangles across polished wood floor, single grand piano center frame, dust motes suspended in the light beams, absolute silence implied

**Subject A:** Dust motes drifting slowly through the light shafts — unhurried, weightless, catching the late afternoon gold
**Subject A Animation Intent:** Dust mote drift is continuous and resets invisibly at frame edge. Movement is slow and completely weightless.

**Subject B:** Light rectangles on the floor shifting almost imperceptibly as the sun moves — the edge of the light traveling slowly across the floor grain
**Subject B Animation Intent:** Light shift is too slow to perceive as motion within a 30-second window. Creates a feeling of suspended time. The piano never moves.

**Loop Notes:** Dust drift is continuous and invisible reset. Light shift has no loop point within normal segment length. The loop is hidden inside the suspended-time feeling.

**Base Palette:** Warm amber gold, rich dark wood, deep shadow beyond the light shafts, cream white walls, the piano is dark and anchoring

**Avoid:** People, performers, anything busy or cluttered, modern elements, cold light, darkness, anything that breaks the feeling of an empty room holding its breath

---

## Universe Modifier Library

---

### GROUP 1 MODIFIERS — Lofi / Study / Jazzhop

| Modifier | Art Style | Environment Shift | Color Shift |
|----------|-----------|-------------------|-------------|
| Cyberpunk / Neo Tokyo | Anime cel-shaded or neon photorealism | Neon signs outside, holographic displays, rain-slicked streets below, cramped high-rise apartment | Hot pink, electric blue, deep purple |
| Space Station / Orbital | Hard sci-fi photorealism | Porthole replaces window, Earth or nebula beyond, zero-g floating objects, sterile corridors | Deep black, cool blue, soft white light |
| Gothic / Gotham | Dark graphic novel, high contrast | Gargoyles outside, rain on stone, distant dark spires, gas lamps replacing electric light | Near black, cold grey, single amber light |
| Feudal Japan | Ukiyo-e woodblock or soft anime | Shoji screens, paper lanterns, cherry blossoms outside, tatami floor, scrolls replace books | Pale pink, ink black, soft grey, warm gold |
| Fantasy / Medieval | Oil painting or illuminated manuscript | Stone walls, candlelight, scrolls replace books, castle ramparts visible outside, fireplace | Deep burgundy, forest green, warm gold |
| Solarpunk | Lush editorial illustration | Overgrown plants everywhere, soft natural light, community garden visible outside, wood and vine architecture | Deep green, warm yellow, terracotta, sky blue |
| Underwater / Abyssal | Dreamlike photorealism | Bioluminescent glow replaces lamp, fish drifting past porthole, coral on walls, pressure condensation on glass | Deep teal, soft green, cool violet, black abyss beyond |
| Post-Apocalyptic | Gritty desaturated photorealism | Broken city outside, overgrown ruins through cracked window, flickering salvaged light, dust everywhere | Desaturated grey-green, rust orange, faint amber |
| Cottagecore / Fairytale | Soft watercolor illustration | Mushroom garden outside, fireflies drifting in, dried herbs hanging, warm candlelight, thatched walls | Sage green, warm cream, soft pink, golden hour light |
| Afrofuturist | Vibrant digital illustration | Rich geometric patterns on walls, celestial architecture outside, warm otherworldly light, kente-inspired textiles | Deep gold, royal purple, bright terracotta, warm copper |

---

### GROUP 2 MODIFIERS — Dark Ambient / Cinematic / Fantasy

| Modifier | Art Style | Environment Shift | Color Shift |
|----------|-----------|-------------------|-------------|
| Tim Burton | Expressionist gothic illustration, high contrast | Twisted impossible architecture, spiraling towers, dead twisted trees, carnival decay, wrong proportions throughout | Stark black and white with single accent — sickly green or blood red |
| Lord of the Rings | Epic painterly photorealism, Tolkien illustration | Ancient stonework of impossible age, Elvish or Dwarven architectural language, runes carved deep, torch-lit vast halls | Deep earth brown, cold grey stone, warm torch gold, forest green |
| Legend (1985) | Dark fairy tale painterly, rich saturated | Primeval ancient forest floor, enormous gnarled roots, darkness punctuated by single magical light source, fairy dust particles | Deep forest black, rich jewel tones — emerald and deep red, single shaft of supernatural light |
| Alien / HR Giger | Biomechanical photorealism, obsidian surfaces | Organic-machine hybrid architecture, ribbed tunnel walls that are simultaneously bone and metal, egg-like structures in darkness, everything wet and glistening | Near black, slick obsidian, cold blue-green bioluminescence, zero warmth |
| Retro Sci-Fi / Kubrick | Clinical photorealism, geometric perfection | Stark white corridors, HAL-red single eye light source, bone-white furniture of impossible cleanliness, starfield beyond perfect circular windows | Pure white, bone, HAL red, infinite black of space |
| Modern Sci-Fi / Ex Machina | Architectural minimalism, cold photorealism | Brutalist concrete and glass, recessed lighting strips, polished reflective floors, untouched forest or mountain visible beyond floor-to-ceiling glass | Cool grey, clinical white, natural wood accent, forest green beyond glass |
| Anime Sci-Fi / Akira + Kaiju No. 8 | Anime cel-shaded, high contrast ink lines | Destroyed megalopolis outside, chunky mech infrastructure, massive scale dwarfing human elements, psychedelic energy signatures | Deep navy, neon red and blue energy, concrete grey, explosion orange |

---

### GROUP 4 MODIFIERS — Synthwave / Electronic

| Modifier | Art Style | Environment Shift | Color Shift |
|----------|-----------|-------------------|-------------|
| Mobile Suit Gundam | Detailed mechanical anime, hard lines | Massive mobile suit hangar, Federation or Zeon industrial architecture, mobile suits in dock partially visible in darkness, warning lights, overwhelming scale | Federation white and blue OR Zeon grey and red, industrial yellow warning, deep shadow |
| Neon Genesis Evangelion | Psychological surrealist anime, GAINAX | NERV underground facility geometry, the Geofront visible beyond, MAGI computer banks, orange-red alert lighting, Eva units in cage partially visible | NERV orange and black, deep purple Geofront sky, blood red alert, clinical white |

---

### GROUP 5 MODIFIERS — Epic / Orchestral

| Modifier | Art Style | Environment Shift | Color Shift |
|----------|-----------|-------------------|-------------|
| Lord of the Rings | Epic painterly photorealism | Rohan plains to horizon, Minas Tirith in distance, Rivendell falls and ancient stone, Middle Earth scale | Deep earth, cold mountain grey, warm torch gold, vast sky |
| Tim Burton | Expressionist gothic illustration | Twisted impossible landscape, dead trees clawing at dramatic sky, single impossible structure on the horizon | Stark black, sickly accent, dramatic high contrast sky |
| Alien / HR Giger | Biomechanical photorealism | Ancient derelict structure at colossal scale, horseshoe ship on barren planetscape, fossilized architecture | Obsidian black, cold teal, barren grey planetscape |
| Retro Sci-Fi / Kubrick | Clinical geometric photorealism | Monolith on barren landscape, orbital station in vast space, stark geometry against infinite black | Pure white, bone, HAL red, infinite black |
| Modern Sci-Fi / Ex Machina | Architectural minimalism | Isolated brutalist structure in untouched wilderness, glass and concrete against ancient forest or mountain | Cool grey, clinical white, deep forest green |
| Anime Sci-Fi / Akira + Kaiju No. 8 | Cel-shaded epic scale | Destroyed city at impossible scale from above, kaiju silhouette on horizon, energy signatures in sky | Deep navy, neon energy, destruction orange, concrete grey |
| Gothic / Gotham | Dark graphic novel | Storm-lashed Gothic skyline, cathedral spires, vast dark city sprawl below dramatic clouds | Near black, cold grey, single amber break in clouds |
| Fantasy / Medieval | Epic oil painting | Vast castle on clifftop, armies on plain below, dragon silhouette against storm sky, ancient forest edge | Deep burgundy, storm grey, dramatic gold light break |
| Post-Apocalyptic | Gritty desaturated photorealism | Overgrown ruins of a vast civilization, nature reclaiming everything, lone structure still standing | Desaturated grey-green, rust, single warm light source |
