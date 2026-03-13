import { ApiError } from '../errors/index.js';
import { requireEnv } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('telegram-service');

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface ApprovalRequest {
  videoTitle: string;
  youtubeUrl: string;
  thumbnailUrl?: string;
  channelName: string;
}

interface TelegramMessage {
  message_id: number;
}

export async function sendApprovalRequest(request: ApprovalRequest): Promise<number> {
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');

  const message = [
    `🎬 <b>New Video Ready for Approval</b>`,
    ``,
    `<b>Channel:</b> ${escapeHtml(request.channelName)}`,
    `<b>Title:</b> ${escapeHtml(request.videoTitle)}`,
    `<b>Preview:</b> ${request.youtubeUrl}`,
    ``,
    `Reply with /approve or /reject`,
  ].join('\n');

  log.info(`Sending approval request for "${request.videoTitle}"`);

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(
        `Telegram API returned ${response.status}: ${errorBody}`,
        'telegram',
        response.status
      );
    }

    const result = (await response.json()) as { result: TelegramMessage };
    log.info(`Approval request sent, message ID: ${result.result.message_id}`);

    return result.result.message_id;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `Telegram send failed: ${(error as Error).message}`,
      'telegram',
      undefined,
      error as Error
    );
  }
}

export async function pollForApproval(messageId: number, timeoutMinutes = 60): Promise<boolean> {
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');

  const deadline = Date.now() + timeoutMinutes * 60 * 1000;
  let lastUpdateId = 0;

  log.info(`Polling for approval (timeout: ${timeoutMinutes}m)`);

  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `${TELEGRAM_API_BASE}${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`,
        { method: 'GET' }
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        result: Array<{
          update_id: number;
          message?: {
            chat: { id: number };
            text?: string;
            reply_to_message?: { message_id: number };
          };
        }>;
      };

      for (const update of data.result) {
        lastUpdateId = update.update_id;
        const msg = update.message;

        if (
          msg &&
          String(msg.chat.id) === chatId &&
          msg.reply_to_message?.message_id === messageId
        ) {
          const text = msg.text?.toLowerCase().trim();
          if (text === '/approve') {
            log.info('Video APPROVED');
            return true;
          }
          if (text === '/reject') {
            log.info('Video REJECTED');
            return false;
          }
        }
      }
    } catch (error) {
      log.warn(`Poll error: ${(error as Error).message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  log.warn('Approval timed out');
  return false;
}

export async function sendPhoto(filePath: string, caption?: string): Promise<number> {
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');
  return sendFile(botToken, chatId, 'sendPhoto', 'photo', filePath, caption);
}

export async function sendVideo(filePath: string, caption?: string): Promise<number> {
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');
  return sendFile(botToken, chatId, 'sendVideo', 'video', filePath, caption);
}

export async function sendAudio(filePath: string, caption?: string): Promise<number> {
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');
  return sendFile(botToken, chatId, 'sendAudio', 'audio', filePath, caption);
}

export async function sendDocument(filePath: string, caption?: string): Promise<number> {
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');
  return sendFile(botToken, chatId, 'sendDocument', 'document', filePath, caption);
}

async function sendFile(
  botToken: string,
  chatId: string,
  method: string,
  fieldName: string,
  filePath: string,
  caption?: string,
): Promise<number> {
  const { createReadStream } = await import('fs');
  const { stat } = await import('fs/promises');
  const { basename } = await import('path');

  const fileStats = await stat(filePath);
  const fileName = basename(filePath);

  log.info(`Sending ${fieldName} to Telegram: ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(1)}MB)`);

  // Read file into buffer for multipart upload
  const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  const boundary = `----FormBoundary${Date.now()}`;
  const parts: Buffer[] = [];

  // chat_id field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`
  ));

  // caption field
  if (caption) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`
    ));
  }

  // file field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
  ));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new ApiError(
      `Telegram ${method} failed ${response.status}: ${errorBody}`,
      'telegram',
      response.status
    );
  }

  const result = (await response.json()) as { result: TelegramMessage };
  log.info(`${fieldName} sent, message ID: ${result.result.message_id}`);
  return result.result.message_id;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
