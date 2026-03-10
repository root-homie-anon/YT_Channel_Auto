// === Channel Configuration Types ===

export interface ChannelConfig {
  channel: {
    name: string;
    slug: string;
    format: ChannelFormat;
    niche: string;
  };
  credentials: {
    youtubeOAuthPath: string;
    elevenLabsVoiceId: string;
  };
  frameworks: FrameworkPaths;
  musicOnly?: {
    defaultDurationHours: number | null;
    defaultSegmentCount: number | null;
  };
}

export type ChannelFormat = 'long' | 'short' | 'long+short' | 'music-only';

export interface FrameworkPaths {
  script: string;
  image: string;
  music: string;
  thumbnail: string;
  title: string;
  teaser?: string;
}

// === Content Planning Types ===

export interface ContentPlan {
  topic: string;
  angle: string;
  keyPoints: string[];
  targetDurationSeconds: number;
  format: ChannelFormat;
}

// === Script Types ===

export interface ScriptOutput {
  title: string;
  script: ScriptSection[];
  description: string;
  tags: string[];
  hashtags: string[];
  teaserScript?: ScriptSection[];
}

export interface ScriptSection {
  sectionName: string;
  narration: string;
  imageCue: string;
  durationSeconds: number;
}

// === Asset Types ===

export interface AssetManifest {
  images: AssetFile[];
  voiceover: AssetFile[];
  music: AssetFile[];
  animations: AssetFile[];
}

export interface AssetFile {
  id: string;
  path: string;
  type: AssetType;
  durationSeconds?: number;
  metadata?: Record<string, string>;
}

export type AssetType = 'image' | 'voiceover' | 'music' | 'animation';

// === Video Compilation Types ===

export interface CompilationResult {
  videoPath: string;
  thumbnailPath: string;
  durationSeconds: number;
  resolution: string;
  fileSizeBytes: number;
  teaserVideoPath?: string;
}

// === Publishing Types ===

export interface PublishRequest {
  videoPath: string;
  thumbnailPath: string;
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  scheduledTime?: Date;
  privacy: 'private' | 'unlisted' | 'public';
}

export interface PublishResult {
  youtubeVideoId: string;
  youtubeUrl: string;
  status: 'uploaded' | 'pending_approval' | 'approved' | 'rejected' | 'published';
  scheduledTime?: Date;
}

// === Pipeline Types ===

export interface PipelineContext {
  channelConfig: ChannelConfig;
  channelDir: string;
  outputDir: string;
  contentPlan: ContentPlan;
  scriptOutput?: ScriptOutput;
  assetManifest?: AssetManifest;
  compilationResult?: CompilationResult;
  publishResult?: PublishResult;
}

export type PipelineStage =
  | 'planning'
  | 'scripting'
  | 'asset_generation'
  | 'compilation'
  | 'approval'
  | 'publishing'
  | 'complete'
  | 'failed';

export interface PipelineStatus {
  stage: PipelineStage;
  startedAt: Date;
  updatedAt: Date;
  error?: string;
}
