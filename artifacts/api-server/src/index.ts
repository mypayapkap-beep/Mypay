import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  const fast2smsSenderId = process.env.FAST2SMS_SENDER_ID;
  const fast2smsTemplateId = process.env.FAST2SMS_TEMPLATE_ID;
  const nodeEnv = process.env.NODE_ENV ?? "not set";
  const dltReady = !!fast2smsKey && !!fast2smsSenderId && !!fast2smsTemplateId;
  if (dltReady) {
    logger.info(
      { apiKeyLength: fast2smsKey!.length, senderIdConfigured: true, templateIdConfigured: true, route: "dlt", nodeEnv },
      "FAST2SMS: DLT route ready — real OTP SMS will be sent",
    );
  } else if (fast2smsKey) {
    logger.warn(
      { senderIdConfigured: !!fast2smsSenderId, templateIdConfigured: !!fast2smsTemplateId, nodeEnv },
      "FAST2SMS: API key set but FAST2SMS_SENDER_ID or FAST2SMS_TEMPLATE_ID missing — OTP SMS will fail until both are configured",
    );
  } else {
    logger.warn(
      { nodeEnv },
      nodeEnv === "production"
        ? "FAST2SMS: API key NOT set in production — OTP requests will be blocked"
        : "FAST2SMS: API key NOT set — dev mode, devOtp will be returned instead of real SMS",
    );
  }
});
