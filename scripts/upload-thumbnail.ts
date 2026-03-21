import { setThumbnail } from '../src/services/youtube-service.js';

const [,, oauthPath, videoId, thumbPath] = process.argv;
if (!oauthPath || !videoId || !thumbPath) {
  console.error('Usage: npx tsx scripts/upload-thumbnail.ts <oauthPath> <videoId> <thumbPath>');
  process.exit(1);
}

try {
  await setThumbnail(oauthPath, videoId, thumbPath);
  console.log(`Thumbnail uploaded for ${videoId}`);
} catch (err) {
  console.error(`Failed: ${(err as Error).message}`);
  process.exit(1);
}
