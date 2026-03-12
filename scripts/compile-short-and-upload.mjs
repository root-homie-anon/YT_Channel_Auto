import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { compileShortFormVideo } from '../src/services/ffmpeg-service.js';
import { uploadVideo } from '../src/services/youtube-service.js';

const outputDir = resolve('projects/ch-strange-universe/output/20260312-170623-zdfw');
const teaserManifest = JSON.parse(readFileSync(join(outputDir, 'teaser-manifest.json'), 'utf-8'));
const scriptOutput = JSON.parse(readFileSync(join(outputDir, 'script-output.json'), 'utf-8'));
const oauthPath = resolve('projects/ch-strange-universe/.youtube-oauth.json');

// --- Compile short ---
console.log('=== Compiling short-form (9:16) ===');
const shortResult = await compileShortFormVideo({
  outputDir: join(outputDir, 'teaser'),
  manifest: teaserManifest,
  sections: scriptOutput.teaserScript,
  resolution: '1080x1920',
});
console.log('Short:', shortResult.durationSeconds + 's,', (shortResult.fileSizeBytes / 1024 / 1024).toFixed(1) + 'MB');

// --- Upload long-form to YouTube ---
console.log('\n=== Uploading long-form to YouTube (unlisted) ===');
const longResult = await uploadVideo(oauthPath, {
  videoPath: join(outputDir, 'final-video.mp4'),
  thumbnailPath: join(outputDir, 'thumbnail.png'),
  title: scriptOutput.title,
  description: scriptOutput.description,
  tags: scriptOutput.tags,
  hashtags: scriptOutput.hashtags,
  privacy: 'unlisted',
});
console.log('YouTube:', longResult.youtubeUrl);

// --- Send short to Telegram ---
console.log('\n=== Sending short to Telegram ===');
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const FormData = (await import('node:buffer')).Blob ? null : null;
// Use curl via child_process for multipart upload
import { execSync } from 'child_process';
execSync(`curl -s -X POST "https://api.telegram.org/bot${botToken}/sendVideo" -F "chat_id=${chatId}" -F "video=@${join(outputDir, 'teaser/teaser-video.mp4')}" -F "caption=UAP Caught on Film — Short (9:16 portrait images, with music)" -F "supports_streaming=true"`);

// Send YouTube link to Telegram
execSync(`curl -s -X POST "https://api.telegram.org/bot${botToken}/sendMessage" -H "Content-Type: application/json" -d '{"chat_id":"${chatId}","text":"UAP Caught on Film — Long-form uploaded (unlisted)\\n${longResult.youtubeUrl}"}'`);

console.log('\n=== All done ===');
