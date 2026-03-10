export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly configPath: string
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class AssetError extends Error {
  constructor(
    message: string,
    public readonly assetType: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AssetError';
  }
}

export class CompilationError extends Error {
  constructor(
    message: string,
    public readonly command?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CompilationError';
  }
}
