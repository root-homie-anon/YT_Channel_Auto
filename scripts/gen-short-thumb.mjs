import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const prompt = `Generate a TALL VERTICAL portrait image in 9:16 aspect ratio — much taller than it is wide, like a phone screen.

A dark cinematic vertical scene of a Soviet underground bunker viewed from below. A narrow concrete corridor stretches upward vertically. At the very top, a crack of eerie blue-white light from something unknown above. Red emergency lamps on the walls. A small silhouetted figure stands at the bottom third, looking up, dwarfed by the vertical scale. Debris and old Soviet military equipment scattered at the base.

Three layers of depth stacked vertically: debris at bottom foreground, the figure and corridor walls in the midground, mysterious light source at top background. Volumetric fog drifts through the corridor.

CRITICAL TEXT: The single word "EXPOSED" in HUGE bold white letters, centered horizontally in the upper quarter of the image. The text must be clearly spelled E-X-P-O-S-E-D, exactly 7 letters. Ultra-bold weight, wide letter spacing, pure bright white with dark shadow. The text should be the most prominent element, roughly 70% of the image width.

Colors: deep navy, near-black, red accent lights, cold blue from above. Style: cinematic photorealism, film grain, atmospheric. Mood: dread and mystery.

VERTICAL 9:16 portrait format — the image MUST be taller than wide. High contrast. Readable at small mobile size.

Avoid: cartoonish, alien creatures, bright colors, cluttered, low contrast, faces, watermarks, landscape orientation, square format.`;

console.log(`Generating short thumbnail via ${MODEL}...`);

const response = await ai.models.generateContent({
  model: MODEL,
  contents: prompt,
  config: {
    responseModalities: ['IMAGE', 'TEXT'],
  },
});

const parts = response.candidates?.[0]?.content?.parts;
if (!parts) throw new Error('No parts returned');

const imagePart = parts.find(p => 'inlineData' in p && p.inlineData != null);
const imageData = imagePart?.inlineData?.data;
if (!imageData) throw new Error('No image data returned');

const outDir = 'projects/ch-strange-universe/output/20260312-150810-j3lc';
const rawPath = outDir + '/thumbnail-short-raw.png';
writeFileSync(rawPath, Buffer.from(imageData, 'base64'));
console.log('Raw short thumbnail saved:', rawPath);

const info = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${rawPath}`).toString().trim();
console.log('Raw dimensions (WxH):', info);

const [w, h] = info.split(',').map(Number);
const finalPath = outDir + '/thumbnail-short.png';

if (w >= h) {
  // Wrong orientation — crop center to 9:16 then scale
  console.log('Image is landscape — cropping to 9:16 and scaling to 720x1280');
  execSync(`ffmpeg -y -i ${rawPath} -vf "crop=ih*9/16:ih,scale=720:1280" ${finalPath}`);
} else if (Math.abs(w/h - 9/16) > 0.02) {
  // Right orientation but wrong ratio — pad/crop to exact 9:16
  console.log('Image is portrait but wrong ratio — scaling to 720x1280');
  execSync(`ffmpeg -y -i ${rawPath} -vf "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black" ${finalPath}`);
} else {
  // Correct ratio — just scale
  console.log('Image is correct 9:16 — scaling to 720x1280');
  execSync(`ffmpeg -y -i ${rawPath} -vf "scale=720:1280" ${finalPath}`);
}

const finalInfo = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${finalPath}`).toString().trim();
console.log('Final dimensions:', finalInfo);
console.log('Done:', finalPath);
