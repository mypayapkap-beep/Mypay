import { Router, type IRouter } from "express";
import { sendOtpSms } from "../../lib/otp";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

async function getServerOutboundIp(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as { ip: string };
    return data.ip ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/diagnostics/otp
 * Reports FAST2SMS configuration at runtime. No SMS is sent.
 */
router.get(
  "/diagnostics/otp",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const apiKey = process.env.FAST2SMS_API_KEY;
    const nodeEnv = process.env.NODE_ENV ?? "not set";
    const isProduction = nodeEnv === "production";

    const senderId = process.env.FAST2SMS_SENDER_ID;
    const templateId = process.env.FAST2SMS_TEMPLATE_ID;
    const dltReady = !!apiKey && !!senderId && !!templateId;
    const useDlt = !!(senderId && templateId);
    const activeRoute = !apiKey ? "bypass" : useDlt ? "dlt" : "q";

    const serverIp = await getServerOutboundIp();

    req.log.info(
      { apiKeyConfigured: !!apiKey, senderIdConfigured: !!senderId, templateIdConfigured: !!templateId, nodeEnv, serverIp },
      "OTP diagnostics requested",
    );

    res.json({
      fast2sms: {
        apiKeyConfigured: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiKeyPrefix: apiKey ? `${apiKey.substring(0, 6)}...` : null,
        activeRoute,
        senderIdConfigured: !!senderId,
        templateIdConfigured: !!templateId,
        dltReady,
      },
      runtime: {
        nodeEnv,
        isProduction,
        serverOutboundIp: serverIp,
        ipWhitelistNote: apiKey
          ? `Add this IP to Fast2SMS Dev API → Authorized IPs: ${serverIp ?? "unable to detect"}. Also ensure wallet has credit balance.`
          : "Set FAST2SMS_API_KEY first",
      },
      behaviour: {
        willSendRealSms: !!apiKey,
        willReturnDevOtp: !apiKey && !isProduction,
        willBlockOtpInProduction: !apiKey && isProduction,
        activeRoute,
      },
    });
  },
);

/**
 * POST /api/admin/diagnostics/otp/test
 * Sends a real test OTP via Fast2SMS. Requires FAST2SMS_API_KEY.
 * Body: { mobile: "9999999999", testOtp?: "123456" }
 */
router.post(
  "/diagnostics/otp/test",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const mobile: string = String(req.body?.mobile ?? "").replace(/\D/g, "");
    const testOtp: string = String(req.body?.testOtp ?? "999999");

    if (mobile.length < 10) {
      res.status(400).json({ error: "Provide a valid 10-digit mobile number" });
      return;
    }

    const apiKey = process.env.FAST2SMS_API_KEY;
    const nodeEnv = process.env.NODE_ENV ?? "not set";
    const serverIp = await getServerOutboundIp();

    if (!apiKey) {
      res.json({
        otpSent: false,
        reason: "FAST2SMS_API_KEY is not configured in Replit Secrets",
        apiKeyConfigured: false,
        nodeEnv,
        serverOutboundIp: serverIp,
        fast2smsResponse: null,
      });
      return;
    }

    req.log.info({ mobile, testOtp, serverIp }, "Triggering Fast2SMS test OTP");
    const result = await sendOtpSms(mobile, testOtp);

    res.json({
      otpSent: result.sent,
      apiKeyConfigured: true,
      nodeEnv,
      serverOutboundIp: serverIp,
      fast2smsResponse: result.fast2smsResponse ?? null,
      error: result.error ?? null,
    });
  },
);

export default router;
