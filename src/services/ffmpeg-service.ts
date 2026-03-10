import { execFile } from 'child_process';
import { stat } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

import { CompilationError } from '../errors/index.js';
import { AssetManifest, CompilationResult, ScriptSection } from '../types/index.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('ffmpeg-service');

interface CompileOptions {
  outputDir: string;
  manifest: AssetManifest;
  sections: ScriptSection[];
  resolution?: string;
}

export async function compileLongFormVideo(options: CompileOptions): Promise<CompilationResult> {
  const { outputDir, manifest, sections, resolution = '1920x1080' } = options;
  await ensureDir(outputDir);

  const videoPath = join(outputDir, 'final-video.mp4');
  const [width, height] = resolution.split('x');

  log.info(`Compiling long-form video (${sections.length} sections)`);

  try {
    // Build filter complex for image sequence with voiceover timing
    const inputArgs: string[] = [];
    const filterParts: string[] = [];
    let inputIndex = 0;

    // Add images as inputs with duration matching voiceover
    for (let i = 0; i < manifest.images.length; i++) {
      const image = manifest.images[i];
      const section = sections[i];
      const duration = section?.durationSeconds ?? 5;

      inputArgs.push('-loop', '1', '-t', String(duration), '-i', image.path);
      filterParts.push(
        `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`
      );
      inputIndex++;
    }

    // Add voiceover files
    const voInputStart = inputIndex;
    for (const vo of manifest.voiceover) {
      inputArgs.push('-i', vo.path);
      inputIndex++;
    }

    // Add background music
    let musicInputIndex = -1;
    if (manifest.music.length > 0) {
      inputArgs.push('-i', manifest.music[0].path);
      musicInputIndex = inputIndex;
      inputIndex++;
    }

    // Concatenate video streams
    const videoConcat = manifest.images.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${videoConcat}concat=n=${manifest.images.length}:v=1:a=0[vout]`);

    // Concatenate voiceover audio
    const audioConcat = manifest.voiceover.map((_, i) => `[${voInputStart + i}:a]`).join('');
    filterParts.push(`${audioConcat}concat=n=${manifest.voiceover.length}:v=0:a=1[voaudio]`);

    // Mix voiceover with background music
    if (musicInputIndex >= 0) {
      filterParts.push(
        `[${musicInputIndex}:a]volume=0.15[bgmusic]`,
        `[voaudio][bgmusic]amix=inputs=2:duration=first:dropout_transition=3[aout]`
      );
    } else {
      filterParts.push(`[voaudio]acopy[aout]`);
    }

    const filterComplex = filterParts.join(';');

    const ffmpegArgs = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-y',
      videoPath,
    ];

    await runFfmpeg(ffmpegArgs);

    const stats = await stat(videoPath);
    const duration = await getVideoDuration(videoPath);

    log.info(`Video compiled: ${videoPath} (${duration}s, ${(stats.size / 1024 / 1024).toFixed(1)}MB)`);

    return {
      videoPath,
      thumbnailPath: '', // Generated separately
      durationSeconds: duration,
      resolution,
      fileSizeBytes: stats.size,
    };
  } catch (error) {
    if (error instanceof CompilationError) throw error;
    throw new CompilationError(
      `Long-form compilation failed: ${(error as Error).message}`,
      undefined,
      error as Error
    );
  }
}

export async function compileShortFormVideo(options: CompileOptions): Promise<CompilationResult> {
  const { outputDir, manifest, sections, resolution = '1080x1920' } = options;
  await ensureDir(outputDir);

  const videoPath = join(outputDir, 'teaser-video.mp4');
  const [width, height] = resolution.split('x');

  log.info(`Compiling short-form video (${sections.length} sections)`);

  try {
    const inputArgs: string[] = [];
    const filterParts: string[] = [];
    let inputIndex = 0;

    for (let i = 0; i < manifest.images.length; i++) {
      const image = manifest.images[i];
      const section = sections[i];
      const duration = section?.durationSeconds ?? 3;

      inputArgs.push('-loop', '1', '-t', String(duration), '-i', image.path);
      filterParts.push(
        `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`
      );
      inputIndex++;
    }

    const voInputStart = inputIndex;
    for (const vo of manifest.voiceover) {
      inputArgs.push('-i', vo.path);
      inputIndex++;
    }

    const videoConcat = manifest.images.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${videoConcat}concat=n=${manifest.images.length}:v=1:a=0[vout]`);

    const audioConcat = manifest.voiceover.map((_, i) => `[${voInputStart + i}:a]`).join('');
    filterParts.push(`${audioConcat}concat=n=${manifest.voiceover.length}:v=0:a=1[aout]`);

    const filterComplex = filterParts.join(';');

    const ffmpegArgs = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-y',
      videoPath,
    ];

    await runFfmpeg(ffmpegArgs);

    const stats = await stat(videoPath);
    const duration = await getVideoDuration(videoPath);

    return {
      videoPath,
      thumbnailPath: '',
      durationSeconds: duration,
      resolution,
      fileSizeBytes: stats.size,
    };
  } catch (error) {
    if (error instanceof CompilationError) throw error;
    throw new CompilationError(
      `Short-form compilation failed: ${(error as Error).message}`,
      undefined,
      error as Error
    );
  }
}

export async function compileMusicOnlyVideo(
  outputDir: string,
  manifest: AssetManifest,
  resolution = '1920x1080'
): Promise<CompilationResult> {
  await ensureDir(outputDir);
  const videoPath = join(outputDir, 'music-video.mp4');
  const [width, height] = resolution.split('x');

  log.info('Compiling music-only video');

  try {
    const inputArgs: string[] = [];
    const filterParts: string[] = [];

    // Single image looped for music duration
    if (manifest.images.length > 0 && manifest.music.length > 0) {
      inputArgs.push('-loop', '1', '-i', manifest.images[0].path);
      inputArgs.push('-i', manifest.music[0].path);

      filterParts.push(
        `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[vout]`
      );

      const ffmpegArgs = [
        ...inputArgs,
        '-filter_complex', filterParts.join(';'),
        '-map', '[vout]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        '-y',
        videoPath,
      ];

      await runFfmpeg(ffmpegArgs);
    }

    const stats = await stat(videoPath);
    const duration = await getVideoDuration(videoPath);

    return {
      videoPath,
      thumbnailPath: '',
      durationSeconds: duration,
      resolution,
      fileSizeBytes: stats.size,
    };
  } catch (error) {
    if (error instanceof CompilationError) throw error;
    throw new CompilationError(
      `Music-only compilation failed: ${(error as Error).message}`,
      undefined,
      error as Error
    );
  }
}

export async function generateThumbnail(
  imagePath: string,
  outputPath: string,
  textOverlay?: string
): Promise<string> {
  await ensureDir(join(outputPath, '..'));

  const ffmpegArgs = [
    '-i', imagePath,
    '-vf', textOverlay
      ? `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,` +
        `drawtext=text='${textOverlay.replace(/'/g, "\\'")}':fontsize=64:fontcolor=white:` +
        `borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2`
      : 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
    '-frames:v', '1',
    '-y',
    outputPath,
  ];

  await runFfmpeg(ffmpegArgs);
  log.info(`Thumbnail generated: ${outputPath}`);
  return outputPath;
}

async function runFfmpeg(args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync('ffmpeg', args, {
      maxBuffer: 50 * 1024 * 1024,
    });
    return stdout || stderr;
  } catch (error) {
    const err = error as Error & { stderr?: string };
    throw new CompilationError(
      `FFmpeg failed: ${err.stderr ?? err.message}`,
      `ffmpeg ${args.join(' ')}`
    );
  }
}

async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      videoPath,
    ]);
    return Math.round(parseFloat(stdout.trim()));
  } catch {
    return 0;
  }
}
