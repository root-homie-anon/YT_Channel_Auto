import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { uploadVideo } from '../src/services/youtube-service.js';

const outputDir = resolve('projects/ch-strange-universe/output/20260312-170623-zdfw');
const scriptOutput = JSON.parse(readFileSync(join(outputDir, 'script-output.json'), 'utf-8'));
const oauthPath = resolve('projects/ch-strange-universe/.youtube-oauth.json');

console.log(`Uploading: "${scriptOutput.title}"`);
console.log(`Video: ${join(outputDir, 'final-video.mp4')}`);
console.log(`Thumbnail: ${join(outputDir, 'thumbnail.png')}`);

const result = await uploadVideo(oauthPath, {
  videoPath: join(outputDir, 'final-video.mp4'),
  thumbnailPath: join(outputDir, 'thumbnail.png'),
  title: scriptOutput.title,
  description: scriptOutput.description,
  tags: scriptOutput.tags,
  hashtags: scriptOutput.hashtags,
  privacy: 'unlisted',
});

console.log('Upload complete:', JSON.stringify(result, null, 2));
