import { db } from "@workspace/db";
import { fraudChecksTable } from "@workspace/db";

export async function logFraudCheck(params: {
  userId?: string;
  eventType: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  referenceId?: string;
  referenceType?: string;
  riskScore?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const isFlagged = (params.riskScore ?? 0) >= 70;
  const flagReason = isFlagged
    ? `High risk score: ${params.riskScore}`
    : undefined;

  await db.insert(fraudChecksTable).values({
    userId: params.userId,
    eventType: params.eventType,
    ipAddress: params.ipAddress,
    deviceFingerprint: params.deviceFingerprint,
    riskScore: params.riskScore ?? 0,
    isFlagged,
    flagReason,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
  });
}

export function calculateLoginRiskScore(params: {
  isNewDevice: boolean;
  failedAttempts: number;
  isVpnOrProxy?: boolean;
}): number {
  let score = 0;
  if (params.isNewDevice) score += 20;
  if (params.failedAttempts > 3) score += 30;
  if (params.failedAttempts > 5) score += 20;
  if (params.isVpnOrProxy) score += 30;
  return Math.min(score, 100);
}
