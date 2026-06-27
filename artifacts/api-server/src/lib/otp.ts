import crypto from "crypto";
import { db } from "@workspace/db";
import { otpRequestsTable } from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
import { logger } from "./logger";

export async function sendOtpSms(mobile: string, otp: string): Promise<{ sent: boolean; error?: string; fast2smsResponse?: unknown }> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const isProduction = process.env.NODE_ENV === "production";

  logger.info(
    { mobile, apiKeyConfigured: !!apiKey, nodeEnv: process.env.NODE_ENV },
    "sendOtpSms: checking configuration",
  );

  if (!apiKey) {
    // No SMS provider configured — bypass mode: OTP works but is returned in response
    logger.warn(
      { mobile, isProduction },
      "sendOtpSms: FAST2SMS_API_KEY not set — running in bypass mode, OTP included in response",
    );
    return { sent: true };
  }

  const mobileNumber = mobile.replace("+91", "").replace(/\D/g, "");
  const senderId = process.env.FAST2SMS_SENDER_ID;
  const templateId = process.env.FAST2SMS_TEMPLATE_ID;
  const useDlt = !!(senderId && templateId);

  // Route selection:
  //   - DLT route  → when FAST2SMS_SENDER_ID + FAST2SMS_TEMPLATE_ID are both set
  //                   (required for commercial/bulk SMS under TRAI DLT rules)
  //   - Quick route → when only FAST2SMS_API_KEY is set
  //                   (no website verification or DLT registration required)
  const payload = useDlt
    ? {
        route: "dlt",
        sender_id: senderId,
        message: templateId,
        variables_values: `${otp}|`,
        flash: 0,
        numbers: mobileNumber,
      }
    : {
        route: "q",
        message: `Your MyPay OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`,
        flash: 0,
        numbers: mobileNumber,
      };

  const activeRoute = useDlt ? "dlt" : "q";

  logger.info(
    { mobile, activeRoute, senderIdConfigured: !!senderId, templateIdConfigured: !!templateId },
    "sendOtpSms: sending via Fast2SMS",
  );

  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const httpStatus = response.status;
    const result = await response.json() as { return: boolean; message?: string | string[]; status_code?: number; invalid?: string[] };

    // message can be a string or an array depending on the error type
    const messageText = Array.isArray(result.message)
      ? result.message.join(", ")
      : (result.message ?? "unknown reason");

    logger.info(
      { mobile, httpStatus, fast2smsReturn: result.return, fast2smsMessages: messageText, fast2smsStatusCode: result.status_code },
      "sendOtpSms: Fast2SMS raw response",
    );

    if (!result.return) {
      logger.error(
        { mobile, httpStatus, result },
        `sendOtpSms: Fast2SMS delivery failed — ${messageText}`,
      );
      return { sent: false, error: `Fast2SMS error: ${messageText}`, fast2smsResponse: result };
    }

    logger.info({ mobile, activeRoute }, "sendOtpSms: OTP SMS sent successfully via Fast2SMS");
    return { sent: true, fast2smsResponse: result };
  } catch (err) {
    logger.error({ mobile, err }, "sendOtpSms: HTTP request to Fast2SMS failed");
    return { sent: false, error: "SMS request failed (network error)" };
  }
}

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_REQUESTS = 5;

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function checkOtpRateLimit(
  mobile: string,
  purpose: string,
  ipAddress?: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  );

  const recent = await db
    .select()
    .from(otpRequestsTable)
    .where(
      and(
        eq(otpRequestsTable.mobile, mobile),
        eq(otpRequestsTable.purpose, purpose),
        gt(otpRequestsTable.createdAt, windowStart),
      ),
    );

  const count = recent.length;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - count);

  return { allowed: count < RATE_LIMIT_MAX_REQUESTS, remaining };
}

export async function createOtpRequest(
  mobile: string,
  purpose: string,
  otp: string,
  ipAddress?: string,
): Promise<string> {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const otpHash = hashOtp(otp);

  const [record] = await db
    .insert(otpRequestsTable)
    .values({
      mobile,
      purpose,
      otpHash,
      maxAttempts: MAX_ATTEMPTS,
      ipAddress,
      expiresAt,
    })
    .returning({ id: otpRequestsTable.id });

  return record.id;
}

export async function verifyOtp(
  mobile: string,
  purpose: string,
  otp: string,
): Promise<{ valid: boolean; reason?: string }> {
  const result = await checkOtpValidity(mobile, purpose, otp);
  if (!result.valid) return result;
  await markOtpUsed(result.id!);
  return { valid: true };
}

/**
 * Checks OTP validity WITHOUT marking it as used.
 * Call markOtpUsed() after your critical work succeeds so that if
 * account-creation fails mid-flight the user can retry with the same OTP.
 */
export async function checkOtpValidity(
  mobile: string,
  purpose: string,
  otp: string,
): Promise<{ valid: boolean; reason?: string; id?: string }> {
  const now = new Date();

  const [record] = await db
    .select()
    .from(otpRequestsTable)
    .where(
      and(
        eq(otpRequestsTable.mobile, mobile),
        eq(otpRequestsTable.purpose, purpose),
        eq(otpRequestsTable.isUsed, false),
        gt(otpRequestsTable.expiresAt, now),
      ),
    )
    .orderBy(desc(otpRequestsTable.createdAt))
    .limit(1);

  if (!record) {
    return { valid: false, reason: "OTP not found or expired" };
  }

  if (record.attempts >= record.maxAttempts) {
    return { valid: false, reason: "Too many attempts" };
  }

  await db
    .update(otpRequestsTable)
    .set({ attempts: record.attempts + 1 })
    .where(eq(otpRequestsTable.id, record.id));

  const inputHash = hashOtp(otp);
  if (inputHash !== record.otpHash) {
    logger.warn({ mobile, purpose }, "Invalid OTP attempt");
    return { valid: false, reason: "Invalid OTP" };
  }

  return { valid: true, id: record.id };
}

/** Mark an OTP record as consumed. Call only after all critical work succeeds. */
export async function markOtpUsed(id: string): Promise<void> {
  await db
    .update(otpRequestsTable)
    .set({ isUsed: true, usedAt: new Date() })
    .where(eq(otpRequestsTable.id, id));
}
