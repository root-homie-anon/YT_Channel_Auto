import { ENV } from './env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (ENV.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
}

export function createLogger(context: string) {
  return {
    debug(message: string, data?: unknown): void {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', context, message), data ?? '');
      }
    },
    info(message: string, data?: unknown): void {
      if (shouldLog('info')) {
        console.info(formatMessage('info', context, message), data ?? '');
      }
    },
    warn(message: string, data?: unknown): void {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', context, message), data ?? '');
      }
    },
    error(message: string, data?: unknown): void {
      if (shouldLog('error')) {
        console.error(formatMessage('error', context, message), data ?? '');
      }
    },
  };
}
