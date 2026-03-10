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
    `🎬 *New Video Ready for Approval*`,
    ``,
    `*Channel:* ${escapeMarkdown(request.channelName)}`,
    `*Title:* ${escapeMarkdown(request.videoTitle)}`,
    `*Preview:* ${request.youtubeUrl}`,
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
        parse_mode: 'Markdown',
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

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
