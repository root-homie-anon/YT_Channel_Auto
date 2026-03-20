/**
 * Generate proper metadata for Liminal Synth productions and upload as unlisted.
 * Usage: npx tsx scripts/fix-ls-metadata-upload.ts
 */

import 'dotenv/config';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

interface Production {
  prodId: string;
  videoPath: string;
  durationSeconds: number;
  segmentCount: number;
  imagePrompt: string;
}

const PRODUCTIONS: Production[] = [
  {
    prodId: '20260313-001209-mo3q',
    videoPath: '/home/claude-dev/projects/YT_Channel_Auto/projects/ch-liminal-synth/output/20260313-001209-mo3q/music-video.mp4',
    durationSeconds: 190,
    segmentCount: 1,
    imagePrompt: 'A cyberpunk kid sitting on the monorail gazing into the massive retro-futuristic skyline, neon grid lines on city below, massive retro-futuristic skyline, low-hanging full moon',
  },
  {
    prodId: '20260313-012705-o78r',
    videoPath: '/home/claude-dev/projects/YT_Channel_Auto/projects/ch-liminal-synth/output/20260313-012705-o78r/music-video-final.mp4',
    durationSeconds: 944,
    segmentCount: 5,
    imagePrompt: 'A cyberpunk kid sitting on the monorail gazing into the massive retro-futuristic skyline, neon grid lines on city below, massive retro-futuristic skyline, low-hanging full moon',
  },
];

// Metadata generated following the channel's title-formula.md and description-formula.md
const METADATA: Record<string, { title: string; description: string; hashtags: string[] }> = {
  '20260313-001209-mo3q': {
    title: 'Let the Synths Carry You | Synthwave Mix for Deep Focus & Calm Nights 2026',
    description: `A rooftop monorail above the megacity. Synth pulses dissolving into violet haze.

Sink into 3 minutes of atmospheric synthwave — lush pads, warm bass, and gentle arps designed to quiet your mind and sharpen your focus.

---
🎧 Liminal Synth — Synthwave for focus, relaxation, and late-night sessions.

🔔 Subscribe for new mixes every week.

#liminalsynth #synthwave #darkambient #focusmusic #studymusic #chillsynth #retrowave #ambientmusic #lofi #deepfocus`,
    hashtags: ['#liminalsynth', '#synthwave', '#darkambient', '#focusmusic', '#studymusic', '#chillsynth', '#retrowave', '#ambientmusic'],
  },
  '20260313-012705-o78r': {
    title: 'Drift Above the Neon Grid | 16 Min Synthwave Mix for Late Night Focus 2026',
    description: `The skyline from a monorail window. Drum machines echoing through cold neon corridors.

Disappear into 16 minutes of deep synthwave across 5 scenes — melancholic pads, driving bass, and atmospheric arps crafted to hold your attention without demanding it. Perfect for late-night coding, creative work, or winding down.

---
🎧 Liminal Synth — Synthwave for focus, relaxation, and late-night sessions.

🔔 Subscribe for new mixes every week.

#liminalsynth #synthwave #darkambient #focusmusic #studymusic #chillsynth #retrowave #ambientmusic #lofi #deepfocus`,
    hashtags: ['#liminalsynth', '#synthwave', '#darkambient', '#focusmusic', '#studymusic', '#chillsynth', '#retrowave', '#ambientmusic'],
  },
};

async function main(): Promise<void> {
  const { uploadVideo } = await import('../src/services/youtube-service.js');

  const channelSlug = 'ch-liminal-synth';
  const oauthPath = join(PROJECT_ROOT, 'projects', channelSlug, '.youtube-oauth.json');
  const outputBase = join(PROJECT_ROOT, 'projects', channelSlug, 'output');

  for (const prod of PRODUCTIONS) {
    const prodDir = join(outputBase, prod.prodId);
    const meta = METADATA[prod.prodId];

    console.log(`\n=== ${prod.prodId} ===`);
    console.log(`Title: ${meta.title}`);
    console.log(`Duration: ${prod.durationSeconds}s | Segments: ${prod.segmentCount}`);

    // Update script-output.json with proper metadata
    const scriptPath = join(prodDir, 'script-output.json');
    const scriptOutput = JSON.parse(await readFile(scriptPath, 'utf-8'));
    scriptOutput.title = meta.title;
    scriptOutput.description = meta.description;
    scriptOutput.hashtags = meta.hashtags;
    await writeFile(scriptPath, JSON.stringify(scriptOutput, null, 2));
    console.log('Updated script-output.json');

    // Upload to YouTube as unlisted
    if (!existsSync(prod.videoPath)) {
      console.error(`Video not found: ${prod.videoPath}`);
      continue;
    }

    console.log(`Uploading ${prod.videoPath}...`);
    const result = await uploadVideo(oauthPath, {
      videoPath: prod.videoPath,
      thumbnailPath: '',
      title: meta.title,
      description: meta.description,
      hashtags: meta.hashtags,
      privacy: 'unlisted',
    });

    console.log(`✓ Uploaded: ${result.youtubeUrl}`);

    // Save publish result
    const publishResult = {
      youtubeVideoId: result.youtubeVideoId,
      youtubeUrl: result.youtubeUrl,
      status: 'published',
    };
    await writeFile(join(prodDir, 'publish-result.json'), JSON.stringify(publishResult, null, 2));
  }

  console.log('\nDone');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
