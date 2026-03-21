import { ApiError } from '../errors/index.js';
import { requireEnv, ENV } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { fetchWithTimeout } from '../utils/fetch-helpers.js';

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
    `React 👍 to approve or 👎 to reject`,
    `<i>(or reply /approve or /reject)</i>`,
  ].join('\n');

  log.info(`Sending approval request for "${request.videoTitle}"`);

  try {
    const response = await fetchWithTimeout(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
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
  const ownerId = ENV.TELEGRAM_OWNER_ID;
  if (!ownerId) {
    log.warn('TELEGRAM_OWNER_ID not set — approvals accepted from any chat member');
  }

  log.info(`Polling for approval (timeout: ${timeoutMinutes}m)`);

  while (Date.now() < deadline) {
    try {
      const allowedUpdates = encodeURIComponent(JSON.stringify(['message', 'message_reaction']));
      const response = await fetchWithTimeout(
        `${TELEGRAM_API_BASE}${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30&allowed_updates=${allowedUpdates}`,
        { method: 'GET' },
        45_000
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        result: Array<TelegramUpdate>;
      };

      for (const update of data.result) {
        lastUpdateId = update.update_id;

        // Check text reply (/approve or /reject)
        const msg = update.message;
        if (
          msg &&
          String(msg.chat.id) === chatId &&
          msg.reply_to_message?.message_id === messageId &&
          (!ownerId || String(msg.from?.id) === ownerId)
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

        // Check emoji reaction (👍 = approve, 👎 = reject)
        const reaction = update.message_reaction;
        if (
          reaction &&
          String(reaction.chat.id) === chatId &&
          reaction.message_id === messageId &&
          (!ownerId || String(reaction.user?.id) === ownerId)
        ) {
          const emoji = getReactionEmoji(reaction.new_reaction);
          if (emoji === '👍') {
            log.info('Video APPROVED (reaction)');
            return true;
          }
          if (emoji === '👎') {
            log.info('Video REJECTED (reaction)');
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

export async function sendTextMessage(text: string): Promise<number> {
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');

  const response = await fetchWithTimeout(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new ApiError(`Telegram API returned ${response.status}: ${errorBody}`, 'telegram', response.status);
  }

  const result = (await response.json()) as { result: TelegramMessage };
  return result.result.message_id;
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
  const { stat, readFile } = await import('fs/promises');
  const { basename } = await import('path');

  const fileStats = await stat(filePath);
  const fileName = basename(filePath);

  log.info(`Sending ${fieldName} to Telegram: ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(1)}MB)`);

  const fileBuffer = await readFile(filePath);

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

  const response = await fetchWithTimeout(`${TELEGRAM_API_BASE}${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  }, 120_000);

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

// === Listener Health ===

interface TelegramListenerHealth {
  alive: boolean;
  lastPollAt: Date | null;
}

let _telegramListenerHealth: TelegramListenerHealth = { alive: false, lastPollAt: null };

export function getTelegramListenerHealth(): TelegramListenerHealth {
  return { ..._telegramListenerHealth };
}

/**
 * Background listener that polls Telegram for /approve and /reject replies.
 * Matches replies against pending checkpoints and triggers approval/rejection.
 * No timeout — runs as long as the process is alive. Auto-restarts on crash.
 */
export function startTelegramApprovalListener(
  onApprove: (messageId: number) => Promise<void>,
  onReject: (messageId: number, reason?: string) => Promise<void>,
  getTrackedMessageIds: () => number[]
): void {
  let botToken: string;
  let chatId: string;
  try {
    botToken = requireEnv('TELEGRAM_BOT_TOKEN');
    chatId = requireEnv('TELEGRAM_CHAT_ID');
  } catch {
    log.warn('Telegram not configured — approval listener disabled');
    return;
  }

  let lastUpdateId = 0;
  const listenOwnerId = ENV.TELEGRAM_OWNER_ID;
  if (!listenOwnerId) {
    log.warn('TELEGRAM_OWNER_ID not set — approvals accepted from any chat member');
  }
  log.info('Telegram approval listener started (no timeout)');

  const poll = async (): Promise<void> => {
    try {
      const allowedUpdates = encodeURIComponent(JSON.stringify(['message', 'message_reaction']));
      const response = await fetchWithTimeout(
        `${TELEGRAM_API_BASE}${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30&allowed_updates=${allowedUpdates}`,
        { method: 'GET' },
        45_000
      );

      if (!response.ok) return;

      const data = (await response.json()) as {
        result: Array<TelegramUpdate>;
      };

      const trackedIds = getTrackedMessageIds();

      for (const update of data.result) {
        lastUpdateId = update.update_id;

        // Check text reply (/approve or /reject)
        const msg = update.message;
        if (
          msg &&
          String(msg.chat.id) === chatId &&
          msg.reply_to_message?.message_id &&
          trackedIds.includes(msg.reply_to_message.message_id) &&
          (!listenOwnerId || String(msg.from?.id) === listenOwnerId)
        ) {
          const text = msg.text?.toLowerCase().trim();
          const replyToId = msg.reply_to_message.message_id;

          if (text === '/approve') {
            log.info(`Telegram approval received for message ${replyToId}`);
            await onApprove(replyToId).catch((err) =>
              log.warn(`Approval handler failed: ${(err as Error).message}`)
            );
          } else if (text?.startsWith('/reject')) {
            const reason = msg.text?.slice('/reject'.length).trim() || undefined;
            log.info(`Telegram rejection received for message ${replyToId}`);
            await onReject(replyToId, reason).catch((err) =>
              log.warn(`Rejection handler failed: ${(err as Error).message}`)
            );
          }
        }

        // Check emoji reaction (👍 = approve, 👎 = reject)
        const reaction = update.message_reaction;
        if (
          reaction &&
          String(reaction.chat.id) === chatId &&
          trackedIds.includes(reaction.message_id) &&
          (!listenOwnerId || String(reaction.user?.id) === listenOwnerId)
        ) {
          const emoji = getReactionEmoji(reaction.new_reaction);
          if (emoji === '👍') {
            log.info(`Telegram approval (reaction) for message ${reaction.message_id}`);
            await onApprove(reaction.message_id).catch((err) =>
              log.warn(`Approval handler failed: ${(err as Error).message}`)
            );
          } else if (emoji === '👎') {
            log.info(`Telegram rejection (reaction) for message ${reaction.message_id}`);
            await onReject(reaction.message_id).catch((err) =>
              log.warn(`Rejection handler failed: ${(err as Error).message}`)
            );
          }
        }
      }
    } catch (error) {
      log.warn(`Telegram listener poll error: ${(error as Error).message}`);
    }
  };

  let _lastPollAt: Date | null = null;

  const wrappedPoll = async (): Promise<void> => {
    await poll();
    _lastPollAt = new Date();
    _telegramListenerHealth = { alive: true, lastPollAt: _lastPollAt };
  };

  const loop = async (): Promise<void> => {
    while (true) {
      await wrappedPoll();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  };

  const startLoop = (): void => {
    loop().catch((err) => {
      log.error(`Telegram listener crashed: ${(err as Error).message}. Restarting in 30s...`);
      _telegramListenerHealth = { alive: false, lastPollAt: _telegramListenerHealth.lastPollAt };
      setTimeout(startLoop, 30_000);
    });
  };

  startLoop();
}

interface ReactionType {
  type: string;
  emoji?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    from?: { id: number };
    text?: string;
    reply_to_message?: { message_id: number };
  };
  message_reaction?: {
    chat: { id: number };
    user?: { id: number };
    message_id: number;
    old_reaction: ReactionType[];
    new_reaction: ReactionType[];
  };
}

function getReactionEmoji(reactions: ReactionType[]): string | undefined {
  const emoji = reactions.find((r) => r.type === 'emoji')?.emoji;
  return emoji;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
