/**
 * Visual filter presets for FFmpeg post-processing.
 * Each preset is a list of FFmpeg filter strings that get appended
 * to the video filter chain between scale/pad and the output label.
 *
 * Filters operate on a single video stream — no multi-input overlays.
 * Keep filters subtle; these run on every segment.
 */

export interface VisualFilterPreset {
  name: string;
  description: string;
  filters: string[];
}

/**
 * Built-in presets. Channels reference these by name in config.json.
 * Add new presets here — they become available to all channels immediately.
 */
const PRESETS: Record<string, VisualFilterPreset> = {
  none: {
    name: 'none',
    description: 'No visual filters applied',
    filters: [],
  },

  synthwave: {
    name: 'synthwave',
    description: 'Vignette darkening edges — locked for Liminal Synth',
    filters: [
      'vignette=PI/4',
    ],
  },

  cinematic: {
    name: 'cinematic',
    description: 'Film grain + subtle vignette + contrast boost',
    filters: [
      'vignette=PI/6',
      'noise=alls=8:allf=t',
      'eq=contrast=1.1:saturation=1.05',
    ],
  },

  dreamy: {
    name: 'dreamy',
    description: 'Soft glow + slight desaturation + vignette for ethereal feel',
    filters: [
      'split[main][glow]',
      '[glow]gblur=sigma=20[glowed]',
      '[main][glowed]blend=all_mode=screen:all_opacity=0.2',
      'eq=saturation=0.85',
      'vignette=PI/4',
    ],
  },

  retro: {
    name: 'retro',
    description: 'VHS-style: grain + color shift + scanline hint',
    filters: [
      'noise=alls=15:allf=t',
      'rgbashift=rh=-3:bh=3:rv=2:bv=-2',
      'colorbalance=rs=0.1:gs=-0.05:bs=0.05',
      'vignette=PI/4',
    ],
  },

  noir: {
    name: 'noir',
    description: 'High contrast black and white with grain',
    filters: [
      'hue=s=0',
      'eq=contrast=1.3:brightness=0.02',
      'noise=alls=12:allf=t',
      'vignette=PI/4',
    ],
  },

  ambient: {
    name: 'ambient',
    description: 'Warm tone + soft glow + gentle vignette for relaxing videos',
    filters: [
      'colorbalance=rs=0.05:gs=0.02:bs=-0.03:ms=0.03:mh=0.02',
      'split[main][glow]',
      '[glow]gblur=sigma=15[glowed]',
      '[main][glowed]blend=all_mode=screen:all_opacity=0.12',
      'vignette=PI/5',
    ],
  },
};

/**
 * Get a filter preset by name. Returns 'none' preset if not found.
 */
export function getFilterPreset(name: string): VisualFilterPreset {
  return PRESETS[name] ?? PRESETS.none!;
}

/**
 * Build the FFmpeg filter string for a visual preset.
 * Input label is the current video stream, output label is what to map.
 *
 * For simple filter chains (no split/blend), returns a comma-separated string.
 * For complex chains (with split/blend), returns semicolon-separated filter_complex parts.
 */
export function buildVisualFilterChain(presetName: string): string[] {
  const preset = getFilterPreset(presetName);
  return preset.filters;
}

/**
 * List all available preset names.
 */
export function listFilterPresets(): string[] {
  return Object.keys(PRESETS);
}
