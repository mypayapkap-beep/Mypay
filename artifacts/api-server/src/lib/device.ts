import type { Request } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { deviceSessionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export function extractDeviceInfo(req: Request): {
  fingerprint: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  userAgent: string;
} {
  const ua = req.headers["user-agent"] ?? "unknown";
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  const acceptLang = req.headers["accept-language"] ?? "";
  const acceptEnc = req.headers["accept-encoding"] ?? "";

  const raw = `${ua}|${acceptLang}|${acceptEnc}`;
  const fingerprint = crypto.createHash("sha256").update(raw).digest("hex");

  let deviceType = "web";
  if (/android/i.test(ua)) deviceType = "android";
  else if (/iphone|ipad/i.test(ua)) deviceType = "ios";

  let deviceName = "Unknown Device";
  const uaMatch = ua.match(/\(([^)]+)\)/);
  if (uaMatch) deviceName = uaMatch[1].split(";")[0].trim();

  return { fingerprint, deviceName, deviceType, ipAddress: ip, userAgent: ua };
}

export async function createOrUpdateDeviceSession(params: {
  userId: string;
  fingerprint: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  userAgent: string;
  supabaseSessionId?: string;
}): Promise<string> {
  const existing = await db
    .select()
    .from(deviceSessionsTable)
    .where(
      and(
        eq(deviceSessionsTable.userId, params.userId),
        eq(deviceSessionsTable.deviceFingerprint, params.fingerprint),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(deviceSessionsTable)
      .set({
        isActive: true,
        lastSeenAt: new Date(),
        ipAddress: params.ipAddress,
        supabaseSessionId: params.supabaseSessionId,
      })
      .where(eq(deviceSessionsTable.id, existing[0].id));
    return existing[0].id;
  }

  const [session] = await db
    .insert(deviceSessionsTable)
    .values({
      userId: params.userId,
      deviceFingerprint: params.fingerprint,
      deviceName: params.deviceName,
      deviceType: params.deviceType,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      supabaseSessionId: params.supabaseSessionId,
      isActive: true,
      lastSeenAt: new Date(),
    })
    .returning({ id: deviceSessionsTable.id });

  return session.id;
}

export async function revokeAllDeviceSessions(userId: string): Promise<void> {
  await db
    .update(deviceSessionsTable)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(deviceSessionsTable.userId, userId));
}

export async function revokeDeviceSession(sessionId: string): Promise<void> {
  await db
    .update(deviceSessionsTable)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(deviceSessionsTable.id, sessionId));
}
