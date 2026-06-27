import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get(
  "/profile",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

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
      profile: {
        id: profile.id,
        name: profile.name,
        mobile: profile.mobile,
        referralCode: profile.referralCode,
        sponsorId: profile.sponsorId,
        profileImageUrl: profile.profileImageUrl,
        sellUpiId: profile.sellUpiId ?? null,
        isActive: profile.isActive,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  },
);

router.patch(
  "/profile",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      name: z.string().min(2).max(100).trim().optional(),
      profileImageUrl: z.string().url().optional(),
      sellUpiId: z.string().max(100).trim().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { name, profileImageUrl, sellUpiId } = parsed.data;
    if (!name && !profileImageUrl && sellUpiId === undefined) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (profileImageUrl) updateData.profileImageUrl = profileImageUrl;
    if (sellUpiId !== undefined) updateData.sellUpiId = sellUpiId;

    const [updated] = await db
      .update(profilesTable)
      .set(updateData)
      .where(eq(profilesTable.id, req.user.id))
      .returning();

    req.log.info({ userId: req.user.id }, "Profile updated");

    res.json({
      profile: {
        id: updated.id,
        name: updated.name,
        mobile: updated.mobile,
        referralCode: updated.referralCode,
        profileImageUrl: updated.profileImageUrl,
        sellUpiId: updated.sellUpiId ?? null,
        updatedAt: updated.updatedAt,
      },
    });
  },
);

export default router;
