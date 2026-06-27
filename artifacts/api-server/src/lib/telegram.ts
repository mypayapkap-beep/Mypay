import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Telegram Booster — prepared for future automatic replies.
 *
 * Currently only stores config. Set `telegram_bot_enabled = "true"` in Admin
 * Settings to activate sending when billing is ready.
 *
 * Supported future reply emojis:
 *   🚀 — sell request created
 *   ⏳ — sell request pending
 *   ✅ — sell request approved
 *   ❌ — sell request rejected
 */

interface TelegramConfig {
  botToken: string;
  groupId: string;
  enabled: boolean;
}

async function getTelegramConfig(): Promise<TelegramConfig | null> {
  try {
    const rows = await db
      .select({ key: settingsTable.key, value: settingsTable.value })
      .from(settingsTable)
      .where(
        inArray(settingsTable.key, [
          "telegram_bot_token",
          "telegram_group_id",
          "telegram_bot_enabled",
        ]),
      );

    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const botToken = map["telegram_bot_token"] ?? "";
    const groupId = map["telegram_group_id"] ?? "";
    const enabled = map["telegram_bot_enabled"] === "true";

    if (!botToken || !groupId) return null;
    return { botToken, groupId, enabled };
  } catch (err) {
    logger.warn({ err }, "Failed to load Telegram config");
    return null;
  }
}

/**
 * Send a message to the configured Telegram group.
 * No-ops silently if bot is disabled or config is missing.
 *
 * @param chatId  - Override chat/group ID (defaults to configured group)
 * @param message - Plain text or HTML message
 */
export async function sendTelegramMessage(
  message: string,
  chatId?: string,
): Promise<void> {
  const config = await getTelegramConfig();
  if (!config || !config.enabled) {
    logger.debug("Telegram bot disabled or not configured — skipping message");
    return;
  }

  const targetChat = chatId ?? config.groupId;

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChat,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, "Telegram message failed");
    } else {
      logger.info({ chatId: targetChat }, "Telegram message sent");
    }
  } catch (err) {
    logger.warn({ err }, "Telegram send error");
  }
}

/**
 * Pre-built message templates for future automatic replies.
 */
export const TelegramMessages = {
  sellRequestCreated: (userName: string, amount: string) =>
    `🚀 <b>Sell Request Created</b>\nUser: ${userName}\nAmount: ₹${amount}`,

  sellRequestPending: (userName: string, amount: string) =>
    `⏳ <b>Sell Request Pending</b>\nUser: ${userName}\nAmount: ₹${amount}`,

  sellRequestApproved: (userName: string, amount: string) =>
    `✅ <b>Sell Request Approved</b>\nUser: ${userName}\nAmount: ₹${amount}\nPayment sent to UPI.`,

  sellRequestRejected: (userName: string, amount: string, reason: string) =>
    `❌ <b>Sell Request Rejected</b>\nUser: ${userName}\nAmount: ₹${amount}\nReason: ${reason}`,
};
