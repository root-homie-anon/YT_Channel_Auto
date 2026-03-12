import 'dotenv/config';
import { generateThumbnailNB2 } from '../services/nanobana-service.js';

async function main(): Promise<void> {
  const prompt = `Epic cinematic scene: A massive Soviet underground bunker stretching into darkness. In the center, a towering steel blast door cracked open with eerie cold blue light spilling through the gap. Soviet military equipment and control panels line the walls, indicator lights glowing red. A lone silhouetted figure in a military coat stands before the enormous door, dwarfed by its scale.
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

Avoid: cartoonish or campy elements, flying saucers, alien creatures, bright cheerful colors, busy cluttered compositions, soft low-contrast look, visible human faces, watermarks, cheap stock photo aesthetic. The image should look like a frame from a high-budget documentary or cinematic trailer.`;

  const result = await generateThumbnailNB2({
    prompt,
    aspectRatio: '16:9',
    outputPath: '/home/claude-dev/projects/YT_Channel_Auto/projects/ch-strange-universe/output/20260312-150810-j3lc/thumbnail.png',
    resolution: '4K',
  });
  console.log('Done:', result.filePath);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
