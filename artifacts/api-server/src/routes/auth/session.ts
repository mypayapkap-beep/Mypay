import { Router, type IRouter } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { profilesTable, deviceSessionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../../middlewares/auth";
import {
  revokeAllDeviceSessions,
  revokeDeviceSession,
} from "../../lib/device";

const router: IRouter = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "mypay_secret_fallback";
const ACCESS_TOKEN_EXPIRY = "7d";

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

router.post("/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { refreshToken } = parsed.data;

  let payload: { userId: string; type: string };
  try {
    payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: string; type: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  if (payload.type !== "user_refresh") {
    res.status(401).json({ error: "Invalid token type" });
    return;
  }

  const [profile] = await db
    .select({ id: profilesTable.id, mobile: profilesTable.mobile })
    .from(profilesTable)
    .where(eq(profilesTable.id, payload.userId))
    .limit(1);

  if (!profile) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const newAccessToken = jwt.sign(
    { userId: profile.id, mobile: profile.mobile, type: "user" },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
  const decoded = jwt.decode(newAccessToken) as { exp: number };

  res.json({
    session: {
      accessToken: newAccessToken,
      refreshToken,
      expiresAt: decoded.exp,
    },
  });
});

router.post(
  "/logout",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    req.log.info({ userId: req.user?.id }, "User logged out");
    res.json({ success: true, message: "Logged out successfully" });
  },
);

router.post(
  "/logout-all",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    await revokeAllDeviceSessions(req.user.id);
    req.log.info({ userId: req.user.id }, "User logged out of all devices");
    res.json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  },
);

router.get(
  "/sessions",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sessions = await db
      .select()
      .from(deviceSessionsTable)
      .where(
        and(
          eq(deviceSessionsTable.userId, req.user.id),
          eq(deviceSessionsTable.isActive, true),
        ),
      )
      .orderBy(deviceSessionsTable.lastSeenAt);

    res.json({ sessions });
  },
);

router.delete(
  "/sessions/:sessionId",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    const [session] = await db
      .select({ id: deviceSessionsTable.id })
      .from(deviceSessionsTable)
      .where(
        and(
          eq(deviceSessionsTable.id, raw),
          eq(deviceSessionsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await revokeDeviceSession(raw);
    res.json({ success: true, message: "Session revoked" });
  },
);

router.get(
  "/me",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, req.user.id))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json({
      user: {
        id: profile.id,
        name: profile.name,
        mobile: profile.mobile,
        referralCode: profile.referralCode,
        sponsorId: profile.sponsorId,
        profileImageUrl: profile.profileImageUrl,
        isActive: profile.isActive,
        createdAt: profile.createdAt,
      },
    });
  },
);

export default router;
