import { execFile } from 'child_process';
import { stat } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

import { CompilationError } from '../errors/index.js';
import { AssetManifest, CompilationResult, ScriptSection } from '../types/index.js';
import { ensureDir } from '../utils/file-helpers.js';
import { getFilterPreset } from '../utils/visual-filters.js';
import { createLogger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('ffmpeg-service');

const CROSSFADE_DURATION = 0.8; // seconds of crossfade between images
const SEGMENT_CROSSFADE = 3.0; // seconds of crossfade between music-only segments

// Runway clips play at native speed — no post-processing slowdown.
// Loop timing is optimized by Runway at generation time.

interface CompileOptions {
  outputDir: string;
  manifest: AssetManifest;
  sections: ScriptSection[];
  resolution?: string;
  visualFilterPreset?: string;
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
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration) || duration <= 0) {
      log.warn(`ffprobe returned invalid duration for ${audioPath}: "${stdout.trim()}"`);
      return 0;
    }
    return duration;
  } catch (err) {
    log.warn(`ffprobe failed for ${audioPath}: ${(err as Error).message}. Image timing may be inaccurate.`);
    return 0;
  }
}

/**
 * Scale section durations proportionally so they sum to the actual VO duration.
 * Fallback method when silence detection doesn't produce enough boundaries.
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
  log.info(`Proportional scaling: scripted=${scriptedTotal}s, actual VO=${actualVoDuration.toFixed(1)}s, ratio=${ratio.toFixed(3)}`);
  return sections.map((s) => Math.max(1, Math.round(s.durationSeconds * ratio * 10) / 10));
}

/**
 * Detect silence gaps in a VO file and use them as section boundaries.
 * Returns an array of per-section durations derived from actual audio pauses.
 * Falls back to proportional scaling if not enough boundaries are found.
 */
async function detectSectionBoundaries(
  voPath: string,
  sections: ScriptSection[],
  actualVoDuration: number
): Promise<number[]> {
  const sectionCount = sections.length;
  if (sectionCount <= 1) {
    return [actualVoDuration];
  }

  try {
    // Run silencedetect — look for gaps >= 0.5s at -35dB threshold
    // Section breaks are typically 0.6–1.5s; intra-sentence pauses are shorter
    const { stderr } = await execFileAsync('ffmpeg', [
      '-i', voPath,
      '-af', 'silencedetect=noise=-35dB:d=0.5',
      '-f', 'null', '-',
    ], { maxBuffer: 10 * 1024 * 1024 });

    // Parse silence_start and silence_end pairs
    const silenceStarts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    const silenceEnds = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));

    // Build midpoints of each silence gap (transition point between sections)
    const midpoints: number[] = [];
    for (let i = 0; i < Math.min(silenceStarts.length, silenceEnds.length); i++) {
      const mid = (silenceStarts[i] + silenceEnds[i]) / 2;
      // Skip silences in the first 0.5s or last 0.5s (not real boundaries)
      if (mid > 0.5 && mid < actualVoDuration - 0.5) {
        midpoints.push(mid);
      }
    }

    log.info(`Silence detection found ${midpoints.length} gaps for ${sectionCount - 1} expected boundaries`);

    // We need exactly sectionCount - 1 boundaries
    const neededBoundaries = sectionCount - 1;

    if (midpoints.length < neededBoundaries) {
      // Not enough silence gaps found — fall back to proportional scaling
      log.warn(`Only ${midpoints.length} silence gaps found, need ${neededBoundaries} — falling back to proportional scaling`);
      return scaleSectionDurations(sections, actualVoDuration);
    }

    // If we found more gaps than needed, pick the best ones using scripted timing as a guide
    let boundaries: number[];
    if (midpoints.length === neededBoundaries) {
      boundaries = midpoints;
    } else {
      // Use scripted cumulative durations as expected boundary positions,
      // then find the closest silence midpoint for each expected position
      const scriptedTotal = sections.reduce((sum, s) => sum + s.durationSeconds, 0);
      const ratio = actualVoDuration / scriptedTotal;
      boundaries = [];
      const used = new Set<number>();

      for (let i = 0; i < neededBoundaries; i++) {
        const expectedTime = sections
          .slice(0, i + 1)
          .reduce((sum, s) => sum + s.durationSeconds, 0) * ratio;

        // Find closest unused midpoint
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let j = 0; j < midpoints.length; j++) {
          if (used.has(j)) continue;
          const dist = Math.abs(midpoints[j] - expectedTime);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = j;
          }
        }

        if (bestIdx >= 0) {
          boundaries.push(midpoints[bestIdx]);
          used.add(bestIdx);
        } else {
          // Shouldn't happen, but use expected time as fallback
          boundaries.push(expectedTime);
        }
      }

      // Sort boundaries chronologically
      boundaries.sort((a, b) => a - b);
    }

    // Convert boundaries to per-section durations
    const durations: number[] = [];
    let prevTime = 0;
    for (const boundary of boundaries) {
      durations.push(Math.max(1, Math.round((boundary - prevTime) * 10) / 10));
      prevTime = boundary;
    }
    // Last section: from last boundary to end of VO
    durations.push(Math.max(1, Math.round((actualVoDuration - prevTime) * 10) / 10));

    const totalDuration = durations.reduce((s, d) => s + d, 0);
    log.info(`Silence-based durations (${durations.length} sections, total=${totalDuration.toFixed(1)}s): ${durations.map(d => d.toFixed(1)).join(', ')}`);

    return durations;
  } catch (err) {
    log.warn(`Silence detection failed: ${(err as Error).message} — falling back to proportional scaling`);
    return scaleSectionDurations(sections, actualVoDuration);
  }
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
    const zoomStart = zoomIn ? '1.05' : '1.15';
    const zoomEnd = zoomIn ? '1.15' : '1.05';
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
  const { outputDir, manifest, sections, resolution = '1920x1080', visualFilterPreset } = options;
  await ensureDir(outputDir);

  const videoPath = join(outputDir, 'final-video.mp4');
  const [width, height] = resolution.split('x');

  log.info(`Compiling long-form video (${sections.length} sections)`);

  try {
    // Detect section boundaries from VO silence gaps for accurate image timing
    let durations = sections.map((s) => s.durationSeconds);
    if (manifest.voiceover.length > 0) {
      const actualVoDuration = await probeAudioDuration(manifest.voiceover[0].path);
      if (actualVoDuration > 0) {
        durations = await detectSectionBoundaries(manifest.voiceover[0].path, sections, actualVoDuration);
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

    // Apply visual filters as post-processing pass
    const filterPreset = visualFilterPreset ? getFilterPreset(visualFilterPreset) : null;
    if (filterPreset && filterPreset.filters.length > 0) {
      log.info(`Applying visual filter preset: ${filterPreset.name}`);
      const filteredPath = videoPath.replace('.mp4', '-filtered.mp4');
      const filterChain = filterPreset.filters.join(';');

      const filterArgs = [
        '-i', videoPath,
        '-filter_complex', filterChain,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y', filteredPath,
      ];

      try {
        await runFfmpeg(filterArgs);
        const { rename: renameFile } = await import('fs/promises');
        await renameFile(filteredPath, videoPath);
        log.info(`Visual filters applied: ${filterPreset.name}`);
      } catch (filterErr) {
        log.warn(`Visual filter pass failed (non-fatal): ${(filterErr as Error).message}`);
      }
    }

    const finalStats = await stat(videoPath);
    const finalDuration = await getVideoDuration(videoPath);

    return {
      videoPath,
      thumbnailPath: '', // Generated separately
      durationSeconds: finalDuration,
      resolution,
      fileSizeBytes: finalStats.size,
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
  const { outputDir, manifest, sections, resolution = '1080x1920', visualFilterPreset } = options;
  await ensureDir(outputDir);

  const videoPath = join(outputDir, 'teaser-video.mp4');
  const [width, height] = resolution.split('x');

  log.info(`Compiling short-form video (${sections.length} sections)`);

  try {
    // Detect section boundaries from VO silence gaps for accurate image timing
    let durations = sections.map((s) => s.durationSeconds);
    if (manifest.voiceover.length > 0) {
      const actualVoDuration = await probeAudioDuration(manifest.voiceover[0].path);
      if (actualVoDuration > 0) {
        durations = await detectSectionBoundaries(manifest.voiceover[0].path, sections, actualVoDuration);
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

    // Apply visual filters as post-processing pass
    const filterPreset = visualFilterPreset ? getFilterPreset(visualFilterPreset) : null;
    if (filterPreset && filterPreset.filters.length > 0) {
      log.info(`Applying visual filter preset to short: ${filterPreset.name}`);
      const filteredPath = videoPath.replace('.mp4', '-filtered.mp4');
      const filterChain = filterPreset.filters.join(';');

      const filterArgs = [
        '-i', videoPath,
        '-filter_complex', filterChain,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y', filteredPath,
      ];

      try {
        await runFfmpeg(filterArgs);
        const { rename: renameFile } = await import('fs/promises');
        await renameFile(filteredPath, videoPath);
        log.info(`Visual filters applied to short: ${filterPreset.name}`);
      } catch (filterErr) {
        log.warn(`Visual filter pass on short failed (non-fatal): ${(filterErr as Error).message}`);
      }
    }

    const finalStats = await stat(videoPath);
    const finalDuration = await getVideoDuration(videoPath);

    return {
      videoPath,
      thumbnailPath: '',
      durationSeconds: finalDuration,
      resolution,
      fileSizeBytes: finalStats.size,
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

interface IntroOutroOptions {
  introPath?: string | undefined;
  outroPath?: string | undefined;
  crossfadeDuration?: number | undefined;
}

export async function compileMusicOnlyVideo(
  outputDir: string,
  manifest: AssetManifest,
  resolution = '1920x1080',
  visualFilterPreset?: string,
  introOutro?: IntroOutroOptions
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

      // Trim trailing silence from all music tracks before compilation
      for (const music of manifest.music) {
        if (music?.path) {
          await trimTrailingSilence(music.path);
        }
      }

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
            `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
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
            `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
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
            `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
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
          `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
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

    // Apply visual filters as post-processing pass
    const filterPreset = visualFilterPreset ? getFilterPreset(visualFilterPreset) : null;
    if (filterPreset && filterPreset.filters.length > 0) {
      log.info(`Applying visual filter preset: ${filterPreset.name}`);
      const filteredPath = videoPath.replace('.mp4', '-filtered.mp4');
      const filterChain = filterPreset.filters.join(';');

      const filterArgs = [
        '-i', videoPath,
        '-filter_complex', filterChain,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y', filteredPath,
      ];

      try {
        await runFfmpeg(filterArgs);
        // Replace original with filtered version
        const { rename: renameFile } = await import('fs/promises');
        await renameFile(filteredPath, videoPath);
        log.info(`Visual filters applied: ${filterPreset.name}`);
      } catch (filterErr) {
        log.warn(`Visual filter pass failed (non-fatal): ${(filterErr as Error).message}`);
        // Original video remains intact
      }
    }

    // Stitch intro/outro clips with crossfade
    const ioCrossfade = introOutro?.crossfadeDuration ?? SEGMENT_CROSSFADE;
    let introDurationForOffset = 0;

    if (introOutro?.introPath || introOutro?.outroPath) {
      const mainPath = videoPath.replace('.mp4', '-main.mp4');
      const { rename: renameMain } = await import('fs/promises');
      await renameMain(videoPath, mainPath);

      const ioParts: string[] = [];
      const ioInputs: string[] = [];
      let ioIdx = 0;

      // Collect inputs in order: intro (optional), main, outro (optional)
      if (introOutro?.introPath) {
        ioInputs.push('-i', introOutro.introPath);
        ioIdx++;
      }
      const mainIdx = ioIdx;
      ioInputs.push('-i', mainPath);
      ioIdx++;
      if (introOutro?.outroPath) {
        ioInputs.push('-i', introOutro.outroPath);
        ioIdx++;
      }

      // Scale all inputs to target resolution
      const inputLabels: string[] = [];
      let labelIdx = 0;
      if (introOutro?.introPath) {
        ioParts.push(
          `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[iv${labelIdx}]`
        );
        inputLabels.push(`iv${labelIdx}`);
        labelIdx++;
      }
      ioParts.push(
        `[${mainIdx}:v]scale=${width}:${height}:flags=lanczos,setsar=1,fps=30[iv${labelIdx}]`
      );
      inputLabels.push(`iv${labelIdx}`);
      labelIdx++;
      if (introOutro?.outroPath) {
        const outroIdx = introOutro?.introPath ? 2 : 1;
        ioParts.push(
          `[${outroIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[iv${labelIdx}]`
        );
        inputLabels.push(`iv${labelIdx}`);
        labelIdx++;
      }

      // Probe durations for crossfade offsets
      const ioDurations: number[] = [];
      if (introOutro?.introPath) {
        const d = await getVideoDuration(introOutro.introPath);
        ioDurations.push(d > 0 ? d : 10);
        introDurationForOffset = (d > 0 ? d : 10) - ioCrossfade;
      }
      const mainDur = await getVideoDuration(mainPath);
      ioDurations.push(mainDur > 0 ? mainDur : 60);
      if (introOutro?.outroPath) {
        const d = await getVideoDuration(introOutro.outroPath);
        ioDurations.push(d > 0 ? d : 10);
      }

      // Video crossfade chain
      let prevVLabel = inputLabels[0];
      for (let i = 1; i < inputLabels.length; i++) {
        const outLabel = i === inputLabels.length - 1 ? 'iovout' : `ioxf${i}`;
        const cumDur = ioDurations.slice(0, i).reduce((s, d) => s + d, 0);
        const cumXf = (i - 1) * ioCrossfade;
        const offset = Math.max(0, cumDur - cumXf - ioCrossfade);
        ioParts.push(
          `[${prevVLabel}][${inputLabels[i]}]xfade=transition=fade:duration=${ioCrossfade}:offset=${offset.toFixed(3)}[${outLabel}]`
        );
        prevVLabel = outLabel;
      }

      // Audio crossfade chain
      const audioLabels: string[] = [];
      let aIdx = 0;
      if (introOutro?.introPath) { audioLabels.push(`${aIdx}:a`); aIdx++; }
      audioLabels.push(`${mainIdx}:a`);
      if (introOutro?.outroPath) {
        const outroIdx = introOutro?.introPath ? 2 : 1;
        audioLabels.push(`${outroIdx}:a`);
      }

      let prevALabel = audioLabels[0];
      for (let i = 1; i < audioLabels.length; i++) {
        const outLabel = i === audioLabels.length - 1 ? 'ioaout' : `ioaxf${i}`;
        ioParts.push(
          `[${prevALabel}][${audioLabels[i]}]acrossfade=d=${ioCrossfade}:c1=tri:c2=tri[${outLabel}]`
        );
        prevALabel = outLabel;
      }

      const ioArgs = [
        ...ioInputs,
        '-filter_complex', ioParts.join(';'),
        '-map', '[iovout]', '-map', '[ioaout]',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        '-y', videoPath,
      ];

      await runFfmpeg(ioArgs);

      // Clean up temp main file
      const { unlink } = await import('fs/promises');
      await unlink(mainPath).catch(() => {});

      log.info(`Intro/outro stitched with ${ioCrossfade}s crossfade`);
    }

    const stats = await stat(videoPath);
    const duration = await getVideoDuration(videoPath);

    // Compute segment timestamps for chapter markers
    const segmentTimestamps: { index: number; label: string; startSeconds: number }[] = [];
    if (segmentCount > 1) {
      const segDurations: number[] = [];
      for (let i = 0; i < segmentCount; i++) {
        const pad = String(i).padStart(3, '0');
        const segPath = join(outputDir, `segment-${pad}.mp4`);
        const d = await getVideoDuration(segPath);
        segDurations.push(d > 0 ? d : 60);
      }

      let cumulativeStart = introDurationForOffset;
      for (let i = 0; i < segmentCount; i++) {
        segmentTimestamps.push({
          index: i,
          label: `Scene ${i + 1}`,
          startSeconds: Math.round(cumulativeStart),
        });
        cumulativeStart += segDurations[i] - SEGMENT_CROSSFADE;
      }
    }

    const collectedSegmentPaths: string[] = [];
    if (segmentCount > 1) {
      for (let i = 0; i < segmentCount; i++) {
        const pad = String(i).padStart(3, '0');
        collectedSegmentPaths.push(join(outputDir, `segment-${pad}.mp4`));
      }
    }

    return {
      videoPath,
      thumbnailPath: '',
      durationSeconds: duration,
      resolution,
      fileSizeBytes: stats.size,
      segmentTimestamps: segmentTimestamps.length > 0 ? segmentTimestamps : undefined,
      segmentPaths: collectedSegmentPaths.length > 0 ? collectedSegmentPaths : undefined,
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

/**
 * Escape text for safe use in an FFmpeg drawtext filter value.
 * FFmpeg filter syntax uses ':' as delimiter and '\' as escape character.
 * Order matters: backslash must be escaped first.
 */
function escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')   // backslash → \\
    .replace(/'/g, "\\'")      // single quote → \'
    .replace(/:/g, '\\:')      // colon → \:
    .replace(/\[/g, '\\[')     // [ → \[
    .replace(/]/g, '\\]')      // ] → \]
    .replace(/;/g, '\\;');     // semicolon → \;
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
        `drawtext=text='${escapeFFmpegText(textOverlay)}':fontsize=64:fontcolor=white:` +
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
    const duration = Math.round(parseFloat(stdout.trim()));
    if (isNaN(duration) || duration <= 0) {
      log.warn(`ffprobe returned invalid duration for ${videoPath}: "${stdout.trim()}"`);
      return 0;
    }
    return duration;
  } catch (err) {
    log.warn(`ffprobe failed for ${videoPath}: ${(err as Error).message}`);
    return 0;
  }
}

/**
 * Trim trailing silence from an audio file.
 * Uses silencedetect to find the last non-silent moment, then trims.
 * Returns the path to the trimmed file (overwrites in place).
 */
async function trimTrailingSilence(audioPath: string): Promise<void> {
  try {
    // Detect silence periods (threshold -40dB, min duration 1s)
    const { stderr } = await execFileAsync('ffmpeg', [
      '-i', audioPath,
      '-af', 'silencedetect=noise=-40dB:d=1',
      '-f', 'null', '-',
    ], { maxBuffer: 10 * 1024 * 1024 });

    // Parse silence_start and silence_end entries — find the last period
    const silenceStarts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    if (silenceStarts.length === 0) {
      log.debug(`No trailing silence detected in ${audioPath}`);
      return;
    }

    const lastSilenceStart = silenceStarts[silenceStarts.length - 1];

    // Get total duration to check if silence is actually at the end
    const { stdout: durationOut } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath,
    ]);
    const totalDuration = parseFloat(durationOut.trim());
    const silenceDuration = totalDuration - lastSilenceStart;

    // Only trim if trailing silence is > 2 seconds AND it actually reaches the end of the file
    if (silenceDuration < 2) {
      log.debug(`Trailing silence only ${silenceDuration.toFixed(1)}s — skipping trim`);
      return;
    }

    // Guard: skip if last silence period doesn't extend to within 0.5s of the file end
    // (it may be an internal gap, not actual trailing silence)
    const silenceEnds = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
    const lastSilenceEnd = silenceEnds[silenceEnds.length - 1] ?? totalDuration;
    if (lastSilenceEnd < totalDuration - 0.5) {
      log.debug(`Last silence ends at ${lastSilenceEnd.toFixed(1)}s but file is ${totalDuration.toFixed(1)}s — not trailing silence, skipping trim`);
      return;
    }

    // Add a small fade-out buffer (0.5s) so it doesn't cut abruptly
    const trimPoint = lastSilenceStart + 0.5;

    log.info(`Trimming ${silenceDuration.toFixed(1)}s trailing silence from ${audioPath} (cut at ${trimPoint.toFixed(1)}s)`);

    const trimmedPath = audioPath.replace(/(\.\w+)$/, '-trimmed$1');
    await execFileAsync('ffmpeg', [
      '-i', audioPath,
      '-t', String(trimPoint),
      '-af', `afade=t=out:st=${Math.max(0, trimPoint - 1)}:d=1`,
      '-y', trimmedPath,
    ], { maxBuffer: 10 * 1024 * 1024 });

    // Replace original with trimmed
    const { rename } = await import('fs/promises');
    await rename(trimmedPath, audioPath);
  } catch (err) {
    log.warn(`Silence trim failed (non-fatal): ${(err as Error).message}`);
  }
}
