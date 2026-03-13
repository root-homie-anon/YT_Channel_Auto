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

const CROSSFADE_DURATION = 0.8; // seconds of crossfade between images
const SEGMENT_CROSSFADE = 1.5; // seconds of crossfade between music-only segments

const ANIM_SLOWDOWN = 1.33; // Slow animation to ~75% speed for ambient feel

interface CompileOptions {
  outputDir: string;
  manifest: AssetManifest;
  sections: ScriptSection[];
  resolution?: string;
}

/**
 * Probe the actual duration of an audio file in seconds.
 */
export async function probeAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      audioPath,
    ]);
    return parseFloat(stdout.trim());
  } catch {
    return 0;
  }
}

/**
 * Scale section durations proportionally so they sum to the actual VO duration.
 * This keeps images in sync with the narration.
 */
function scaleSectionDurations(
  sections: ScriptSection[],
  actualVoDuration: number
): number[] {
  const scriptedTotal = sections.reduce((sum, s) => sum + s.durationSeconds, 0);
  if (scriptedTotal <= 0 || actualVoDuration <= 0) {
    return sections.map((s) => s.durationSeconds);
  }
  const ratio = actualVoDuration / scriptedTotal;
  log.info(`Scaling section durations: scripted=${scriptedTotal}s, actual VO=${actualVoDuration.toFixed(1)}s, ratio=${ratio.toFixed(3)}`);
  return sections.map((s) => Math.max(1, Math.round(s.durationSeconds * ratio * 10) / 10));
}

/**
 * Build a filter complex with Ken Burns + crossfade transitions between images.
 * Returns the filter string and the label of the final video output.
 */
function buildKenBurnsCrossfadeFilter(
  imageCount: number,
  durations: number[],
  width: string,
  height: string,
  scaleBase: string,
  crossfadeDuration: number
): { filterParts: string[]; finalVideoLabel: string } {
  const filterParts: string[] = [];

  // Generate zoompan for each image
  for (let i = 0; i < imageCount; i++) {
    const duration = durations[i] ?? 5;
    const totalFrames = Math.round(duration * 30);

    const zoomIn = i % 2 === 0;
    const zoomStart = zoomIn ? '1' : '1.2';
    const zoomEnd = zoomIn ? '1.2' : '1';
    const zoomExpr = `${zoomStart}+(${zoomEnd}-${zoomStart})*on/${totalFrames}`;
    const xExpr = zoomIn
      ? `iw/2-(iw/zoom/2)+on/${totalFrames}*20`
      : `iw/2-(iw/zoom/2)-on/${totalFrames}*20+20`;
    const yExpr = `ih/2-(ih/zoom/2)`;

    // For portrait output (shorts) with landscape source images, center-crop to 9:16
    // before zoompan to prevent stretching. If source images are already portrait
    // (e.g. dedicated 9:16 generations), just scale normally.
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    const isPortrait = h > w;
    const targetRatio = w / h;

    let scaleAndCrop: string;
    if (isPortrait) {
      // Scale height to 3000px, then crop to target ratio if source is wider
      const cropW = Math.round(3000 * targetRatio);
      // crop filter is safe: if source is narrower than cropW, ffmpeg clamps to source width
      scaleAndCrop = `scale=-1:3000,crop='min(iw,${cropW})':3000`;
    } else {
      scaleAndCrop = `scale=${scaleBase}`;
    }

    filterParts.push(
      `[${i}:v]${scaleAndCrop},` +
      `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=30,` +
      `setsar=1,format=yuv420p[v${i}]`
    );
  }

  // Chain crossfade transitions between segments
  if (imageCount <= 1) {
    return { filterParts, finalVideoLabel: 'v0' };
  }

  let prevLabel = `v0`;
  for (let i = 1; i < imageCount; i++) {
    const outLabel = i === imageCount - 1 ? 'vcf' : `xf${i}`;
    // Offset = cumulative duration of previous segments minus accumulated crossfade overlap
    const cumulativeDuration = durations
      .slice(0, i)
      .reduce((sum, d) => sum + d, 0);
    const cumulativeCrossfade = (i - 1) * crossfadeDuration;
    const offset = Math.max(0, cumulativeDuration - cumulativeCrossfade - crossfadeDuration);

    filterParts.push(
      `[${prevLabel}][v${i}]xfade=transition=fade:duration=${crossfadeDuration}:offset=${offset.toFixed(3)}[${outLabel}]`
    );
    prevLabel = outLabel;
  }

  return { filterParts, finalVideoLabel: 'vcf' };
}

export async function compileLongFormVideo(options: CompileOptions): Promise<CompilationResult> {
  const { outputDir, manifest, sections, resolution = '1920x1080' } = options;
  await ensureDir(outputDir);

  const videoPath = join(outputDir, 'final-video.mp4');
  const [width, height] = resolution.split('x');

  log.info(`Compiling long-form video (${sections.length} sections)`);

  try {
    // Scale section durations to match actual VO length
    let durations = sections.map((s) => s.durationSeconds);
    if (manifest.voiceover.length > 0) {
      const actualVoDuration = await probeAudioDuration(manifest.voiceover[0].path);
      if (actualVoDuration > 0) {
        durations = scaleSectionDurations(sections, actualVoDuration);
      }
    }

    const inputArgs: string[] = [];
    let inputIndex = 0;

    // Add images as inputs
    for (let i = 0; i < manifest.images.length; i++) {
      inputArgs.push('-i', manifest.images[i].path);
      inputIndex++;
    }

    // Build Ken Burns + crossfade filter
    const { filterParts, finalVideoLabel } = buildKenBurnsCrossfadeFilter(
      manifest.images.length,
      durations,
      width,
      height,
      '3000:-1',
      CROSSFADE_DURATION
    );

    // Add voiceover (single file with full narration)
    const voInputIndex = inputIndex;
    if (manifest.voiceover.length > 0) {
      inputArgs.push('-i', manifest.voiceover[0].path);
      inputIndex++;
    }

    // Add background music (loop to fill full video duration)
    let musicInputIndex = -1;
    if (manifest.music.length > 0) {
      inputArgs.push('-stream_loop', '-1', '-i', manifest.music[0].path);
      musicInputIndex = inputIndex;
      inputIndex++;
    }

    // Map final video output
    filterParts.push(`[${finalVideoLabel}]null[vout]`);

    // Mix voiceover with background music
    if (manifest.voiceover.length > 0 && musicInputIndex >= 0) {
      filterParts.push(
        `[${musicInputIndex}:a]volume=0.15[bgmusic]`,
        `[${voInputIndex}:a][bgmusic]amix=inputs=2:duration=first:dropout_transition=3[aout]`
      );
    } else if (manifest.voiceover.length > 0) {
      filterParts.push(`[${voInputIndex}:a]acopy[aout]`);
    } else if (musicInputIndex >= 0) {
      filterParts.push(`[${musicInputIndex}:a]acopy[aout]`);
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
    // Scale section durations to match actual VO length
    let durations = sections.map((s) => s.durationSeconds);
    if (manifest.voiceover.length > 0) {
      const actualVoDuration = await probeAudioDuration(manifest.voiceover[0].path);
      if (actualVoDuration > 0) {
        durations = scaleSectionDurations(sections, actualVoDuration);
      }
    }

    const inputArgs: string[] = [];
    let inputIndex = 0;

    // Only use images matching the number of sections (not the full manifest)
    const imageCount = Math.min(manifest.images.length, sections.length);
    for (let i = 0; i < imageCount; i++) {
      inputArgs.push('-i', manifest.images[i].path);
      inputIndex++;
    }

    // Build Ken Burns + crossfade filter
    const { filterParts, finalVideoLabel } = buildKenBurnsCrossfadeFilter(
      imageCount,
      durations,
      width,
      height,
      '-1:3000',
      CROSSFADE_DURATION
    );

    const voInputIndex = inputIndex;
    if (manifest.voiceover.length > 0) {
      inputArgs.push('-i', manifest.voiceover[0].path);
      inputIndex++;
    }

    // Add background music for shorts too
    let musicInputIndex = -1;
    if (manifest.music.length > 0) {
      inputArgs.push('-stream_loop', '-1', '-i', manifest.music[0].path);
      musicInputIndex = inputIndex;
      inputIndex++;
    }

    // Map final video output
    filterParts.push(`[${finalVideoLabel}]null[vout]`);

    // Mix voiceover with background music
    if (manifest.voiceover.length > 0 && musicInputIndex >= 0) {
      filterParts.push(
        `[${musicInputIndex}:a]volume=0.2[bgmusic]`,
        `[${voInputIndex}:a][bgmusic]amix=inputs=2:duration=first:dropout_transition=2[aout]`
      );
    } else if (manifest.voiceover.length > 0) {
      filterParts.push(`[${voInputIndex}:a]acopy[aout]`);
    } else if (musicInputIndex >= 0) {
      filterParts.push(`[${musicInputIndex}:a]acopy[aout]`);
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
  const segmentCount = manifest.music.length;

  log.info(`Compiling music-only video: ${segmentCount} segment(s)`);

  try {
    if (segmentCount > 1) {
      // -- Multi-segment: compile each segment, then concatenate --
      const segmentPaths: string[] = [];

      for (let i = 0; i < segmentCount; i++) {
        const pad = String(i).padStart(3, '0');
        const segPath = join(outputDir, `segment-${pad}.mp4`);
        const hasAnim = manifest.animations[i];
        const music = manifest.music[i];
        const image = manifest.images[i];

        if (hasAnim && music) {
          // Loop animation (slowed) over music track
          const ffmpegArgs = [
            '-stream_loop', '-1', '-i', hasAnim.path,
            '-i', music.path,
            '-filter_complex',
            `[0:v]setpts=${ANIM_SLOWDOWN}*PTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[vout]`,
            '-map', '[vout]', '-map', '1:a',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-c:a', 'aac', '-b:a', '192k',
            '-shortest', '-movflags', '+faststart',
            '-y', segPath,
          ];
          await runFfmpeg(ffmpegArgs);
        } else if (image && music) {
          // Static image looped for music duration
          const ffmpegArgs = [
            '-loop', '1', '-i', image.path,
            '-i', music.path,
            '-filter_complex',
            `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[vout]`,
            '-map', '[vout]', '-map', '1:a',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-c:a', 'aac', '-b:a', '192k',
            '-shortest', '-movflags', '+faststart',
            '-y', segPath,
          ];
          await runFfmpeg(ffmpegArgs);
        }

        segmentPaths.push(segPath);
        log.info(`Segment ${i} compiled: ${segPath}`);
      }

      // Concatenate all segments with audio + video crossfade
      if (segmentPaths.length === 1) {
        const { copyFile } = await import('fs/promises');
        await copyFile(segmentPaths[0], videoPath);
      } else {
        // Probe each segment duration for crossfade offset calculation
        const segDurations: number[] = [];
        for (const sp of segmentPaths) {
          const d = await getVideoDuration(sp);
          segDurations.push(d > 0 ? d : 60);
        }

        const inputArgs: string[] = [];
        for (const sp of segmentPaths) {
          inputArgs.push('-i', sp);
        }

        const filterParts: string[] = [];
        const n = segmentPaths.length;

        // Video crossfade chain
        let prevVideoLabel = '0:v';
        for (let i = 1; i < n; i++) {
          const outLabel = i === n - 1 ? 'vout' : `vxf${i}`;
          // Offset = cumulative duration of all segments up to i, minus accumulated crossfade overlap
          const cumulativeDuration = segDurations
            .slice(0, i)
            .reduce((sum, d) => sum + d, 0);
          const cumulativeCrossfade = (i - 1) * SEGMENT_CROSSFADE;
          const offset = Math.max(0, cumulativeDuration - cumulativeCrossfade - SEGMENT_CROSSFADE);

          filterParts.push(
            `[${prevVideoLabel}][${i}:v]xfade=transition=fade:duration=${SEGMENT_CROSSFADE}:offset=${offset.toFixed(3)}[${outLabel}]`
          );
          prevVideoLabel = outLabel;
        }

        // Audio crossfade chain
        let prevAudioLabel = '0:a';
        for (let i = 1; i < n; i++) {
          const outLabel = i === n - 1 ? 'aout' : `axf${i}`;
          filterParts.push(
            `[${prevAudioLabel}][${i}:a]acrossfade=d=${SEGMENT_CROSSFADE}:c1=tri:c2=tri[${outLabel}]`
          );
          prevAudioLabel = outLabel;
        }

        const ffmpegArgs = [
          ...inputArgs,
          '-filter_complex', filterParts.join(';'),
          '-map', '[vout]', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
          '-c:a', 'aac', '-b:a', '192k',
          '-movflags', '+faststart',
          '-y', videoPath,
        ];
        await runFfmpeg(ffmpegArgs);
      }
    } else {
      // -- Single segment: original logic --
      const hasAnimations = manifest.animations.length > 0;

      if (hasAnimations && manifest.music.length > 0) {
        const inputArgs: string[] = [];
        const filterParts: string[] = [];

        for (let i = 0; i < manifest.animations.length; i++) {
          inputArgs.push('-i', manifest.animations[i].path);
          filterParts.push(
            `[${i}:v]setpts=${ANIM_SLOWDOWN}*PTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
          );
        }

        const musicIdx = manifest.animations.length;
        inputArgs.push('-i', manifest.music[0].path);

        const videoConcat = manifest.animations.map((_, i) => `[v${i}]`).join('');
        filterParts.push(
          `${videoConcat}concat=n=${manifest.animations.length}:v=1:a=0[vcombined]`,
          `[vcombined]loop=-1:size=32767:start=0,fps=30[vout]`
        );

        const ffmpegArgs = [
          ...inputArgs,
          '-filter_complex', filterParts.join(';'),
          '-map', '[vout]',
          '-map', `${musicIdx}:a`,
          '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
          '-c:a', 'aac', '-b:a', '192k',
          '-shortest', '-movflags', '+faststart',
          '-y', videoPath,
        ];

        await runFfmpeg(ffmpegArgs);
      } else if (manifest.images.length > 0 && manifest.music.length > 0) {
        const ffmpegArgs = [
          '-loop', '1', '-i', manifest.images[0].path,
          '-i', manifest.music[0].path,
          '-filter_complex',
          `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[vout]`,
          '-map', '[vout]', '-map', '1:a',
          '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
          '-c:a', 'aac', '-b:a', '192k',
          '-shortest', '-movflags', '+faststart',
          '-y', videoPath,
        ];

        await runFfmpeg(ffmpegArgs);
      }
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
