import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '..', '.env') });

import { sendPhoto, sendAudio, sendVideo } from '../services/telegram-service.js';

const base = resolve(__dirname, '..', '..', 'projects', 'ch-liminal-synth', 'output', 'test-run');

async function main(): Promise<void> {
  console.log('Sending test assets to Telegram...\n');

  await sendPhoto(`${base}/images/segment-001.png`, 'Flux — Synthwave road image');
  await sendVideo(`${base}/animations/anim-001.mp4`, 'Runway ML — Animation (10s)');
  await sendAudio(`${base}/music/track-001.wav`, 'Stable Audio 2.5 — Synthwave track (90s)');
  // Final video is too large for Telegram (50MB limit) — send a 30s preview
  const { execSync } = await import('child_process');
  const previewPath = `${base}/preview-30s.mp4`;
  execSync(
    `ffmpeg -y -i "${base}/music-video.mp4" -t 30 -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 128k "${previewPath}"`,
    { stdio: 'pipe' }
  );
  await sendVideo(previewPath, 'Final video — 30s preview (full video is 85MB)');

  console.log('\nAll files sent to Telegram.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
