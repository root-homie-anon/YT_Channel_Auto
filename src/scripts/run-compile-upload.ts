import { readFile } from 'fs/promises';
import { join } from 'path';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load dotenv first
import { config } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

import { compileLongFormVideo, compileShortFormVideo } from '../services/ffmpeg-service.js';
import { generateThumbnailNB2 } from '../services/nanobana-service.js';
import { uploadVideo } from '../services/youtube-service.js';
import { writeJsonFile, readJsonFile } from '../utils/file-helpers.js';
import { AssetManifest, ScriptOutput } from '../types/index.js';

const OUTPUT_DIR = join(
  PROJECT_ROOT,
  'projects/ch-strange-universe/output/20260312-183125-oqd0'
);
const YOUTUBE_OAUTH_PATH = join(PROJECT_ROOT, 'projects/ch-strange-universe/.youtube-oauth.json');

async function sendTelegramMessage(text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn('Telegram not configured, skipping message');
    return;
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!response.ok) {
    console.warn(`Telegram message failed: ${response.status}`);
  }
}

async function sendTelegramVideo(videoPath: string, caption: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn('Telegram not configured, skipping video send');
    return;
  }

  const { stat } = await import('fs/promises');

  const stats = await stat(videoPath);
  // Telegram max video size is 50MB for bot API
  if (stats.size > 50 * 1024 * 1024) {
    console.warn(`Video too large for Telegram (${(stats.size / 1024 / 1024).toFixed(1)}MB > 50MB), sending link only`);
    await sendTelegramMessage(`Video compiled but too large for Telegram preview (${(stats.size / 1024 / 1024).toFixed(1)}MB). Check output directory.`);
    return;
  }

  const formData = new globalThis.FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', caption);

  const fileBuffer = await readFile(videoPath);
  const blob = new Blob([fileBuffer]);
  formData.append('video', blob, videoPath.split('/').pop() ?? 'video.mp4');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(`Telegram video send failed: ${response.status} ${body}`);
  }
}

async function sendTelegramPhoto(photoPath: string, caption: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const fileBuffer = await readFile(photoPath);
  const blob = new Blob([fileBuffer]);
  const formData = new globalThis.FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', caption);
  formData.append('photo', blob, 'thumbnail.png');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(`Telegram photo send failed: ${response.status} ${body}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Compile + Upload Pipeline ===');

  // Load assets
  const scriptRaw = await readFile(join(OUTPUT_DIR, 'script-output.json'), 'utf-8');
  const scriptOutput: ScriptOutput = JSON.parse(scriptRaw);
  const manifest = await readJsonFile<AssetManifest>(join(OUTPUT_DIR, 'asset-manifest.json'));

  // ============ STEP 3: Compile Videos ============

  // 3a. Compile long-form video (1920x1080)
  console.log('\n--- Compiling long-form video (1920x1080) ---');
  const longResult = await compileLongFormVideo({
    outputDir: OUTPUT_DIR,
    manifest,
    sections: scriptOutput.script,
    resolution: '1920x1080',
  });
  console.log(`Long-form video: ${longResult.videoPath} (${longResult.durationSeconds}s, ${(longResult.fileSizeBytes / 1024 / 1024).toFixed(1)}MB)`);

  // 3b. Compile short-form video (1080x1920) using portrait images
  console.log('\n--- Compiling short-form video (1080x1920) ---');
  let teaserManifest: AssetManifest;
  try {
    teaserManifest = await readJsonFile<AssetManifest>(join(OUTPUT_DIR, 'teaser-manifest.json'));
  } catch {
    // Fallback: build teaser manifest from main manifest
    const teaserSections = scriptOutput.teaserScript ?? scriptOutput.script.slice(0, 5);
    const portraitImages = manifest.portraitImages ?? manifest.images;
    teaserManifest = {
      images: portraitImages.slice(0, teaserSections.length),
      voiceover: manifest.voiceover,
      music: manifest.music,
      animations: [],
    };
  }
  const shortResult = await compileShortFormVideo({
    outputDir: OUTPUT_DIR,
    manifest: teaserManifest,
    sections: scriptOutput.teaserScript ?? scriptOutput.script.slice(0, 5),
    resolution: '1080x1920',
  });
  console.log(`Short-form video: ${shortResult.videoPath} (${shortResult.durationSeconds}s, ${(shortResult.fileSizeBytes / 1024 / 1024).toFixed(1)}MB)`);

  // 3c. Generate thumbnail
  console.log('\n--- Generating thumbnail ---');
  const thumbDir = scriptOutput.productionBrief?.thumbnailDirection;
  const thumbnailPrompt = `Epic cinematic scene: A massive military hangar stretching into darkness. An enormous blast door cracked open with eerie cold blue light spilling through the gap onto a wet concrete floor. Military equipment and storage crates in silhouette line the walls. A lone silhouetted figure in a military coat stands before the enormous door, dwarfed by its scale.
The scene has dramatic depth with three layers: dark silhouetted equipment and crates in the foreground, the massive hangar door and tiny figure in the midground, and mysterious blue light flooding from behind the door in the background.
Volumetric fog and atmospheric haze between layers creates cinematic depth.
Scale contrast: the hangar feels enormous and overwhelming, the human figure is tiny against the massive door.

CRITICAL TEXT REQUIREMENT: The words "${thumbDir?.textOverlay ?? 'THEY ADMITTED IT'}" must be rendered as ENORMOUS bold text across the lower-left portion of the image.
The text must be the single most dominant visual element, covering approximately 40-50% of the image width.
Text style: ultra-bold, wide tracking, pure bright white with subtle shadow for depth. The letters should feel monumental and powerful.
The text must be integrated into the scene composition — it should feel like it belongs in the image, not pasted on top.

Color palette: deep navy blues, rich cold blues, and near-black shadows. Accent lighting in amber from distant overhead lights and cold electric blue from behind the door.
Style: dark cinematic photorealism with film grain, dramatic atmospheric lighting, high production value.
Mood: ${thumbDir?.emotionalHook ?? 'Unease and curiosity — something hidden is being revealed'}.
Lighting: dramatic volumetric rays of blue light through the door gap, warm amber from overhead industrial lamps, strong contrast between lit and shadow areas.

Image must have extremely high contrast — bright elements pop against deep dark backgrounds.
Must be clearly readable and impactful at small thumbnail size (320px width).
16:9 aspect ratio, 4K resolution.

Avoid: cartoonish or campy elements, flying saucers, alien creatures, bright cheerful colors, busy cluttered compositions, soft low-contrast look, visible human faces, watermarks, cheap stock photo aesthetic.`;

  const thumbnailPath = join(OUTPUT_DIR, 'thumbnail.png');
  const thumbnailResult = await generateThumbnailNB2({
    prompt: thumbnailPrompt,
    aspectRatio: '16:9',
    outputPath: thumbnailPath,
    resolution: '4K',
  });
  console.log(`Thumbnail generated: ${thumbnailResult.filePath}`);

  // ============ STEP 4: Upload & Notify ============

  // 4a. Upload long-form to YouTube as unlisted
  console.log('\n--- Uploading long-form to YouTube (unlisted) ---');
  const publishResult = await uploadVideo(YOUTUBE_OAUTH_PATH, {
    videoPath: longResult.videoPath,
    thumbnailPath: thumbnailPath,
    title: scriptOutput.title,
    description: scriptOutput.description,
    tags: scriptOutput.tags,
    hashtags: scriptOutput.hashtags,
    privacy: 'unlisted',
  });
  console.log(`YouTube upload complete: ${publishResult.youtubeUrl}`);

  // 4b. Send short-form video to Telegram
  console.log('\n--- Sending to Telegram ---');
  await sendTelegramVideo(
    shortResult.videoPath,
    `Teaser for: ${scriptOutput.title}\n\nReady for review.`
  );
  console.log('Short-form video sent to Telegram');

  // 4c. Send thumbnail to Telegram
  await sendTelegramPhoto(
    thumbnailPath,
    `Thumbnail for: ${scriptOutput.title}`
  );
  console.log('Thumbnail sent to Telegram');

  // 4d. Send YouTube link to Telegram
  await sendTelegramMessage(
    `<b>New Video Uploaded (Unlisted)</b>\n\n` +
    `<b>Title:</b> ${scriptOutput.title}\n` +
    `<b>YouTube:</b> ${publishResult.youtubeUrl}\n\n` +
    `Reply /approve to make public or /reject to keep unlisted.`
  );
  console.log('YouTube link sent to Telegram');

  // Save final pipeline status
  await writeJsonFile(join(OUTPUT_DIR, 'pipeline-status.json'), {
    stage: 'complete',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    topic: 'UAP Disclosure: Real or Hype?',
    youtubeUrl: publishResult.youtubeUrl,
    youtubeVideoId: publishResult.youtubeVideoId,
    longFormVideo: longResult.videoPath,
    shortFormVideo: shortResult.videoPath,
    thumbnailPath: thumbnailPath,
  });

  console.log('\n=== Pipeline Complete ===');
  console.log(`YouTube: ${publishResult.youtubeUrl}`);
  console.log(`Long video: ${longResult.videoPath}`);
  console.log(`Short video: ${shortResult.videoPath}`);
  console.log(`Thumbnail: ${thumbnailPath}`);
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
