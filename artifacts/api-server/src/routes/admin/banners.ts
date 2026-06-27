import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { bannersTable, adminLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

const BannerBody = z.object({
  title: z.string().min(1).max(200),
  imageUrl: z.string().url(),
  linkUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

// POST /api/admin/banners — create banner
router.post("/banners", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = BannerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { title, imageUrl, linkUrl, sortOrder, startsAt, endsAt } = parsed.data;

  const [banner] = await db
    .insert(bannersTable)
    .values({
      title,
      imageUrl,
      linkUrl,
      sortOrder,
      isActive: true,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      endsAt: endsAt ? new Date(endsAt) : undefined,
    })
    .returning();

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "banner_created",
    targetType: "banner",
    targetId: banner.id,
    newValue: JSON.stringify({ title, imageUrl }),
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, bannerId: banner.id }, "Banner created");
  res.status(201).json({ success: true, banner });
});

// DELETE /api/admin/banners/:id — delete banner
router.delete("/banners/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = req.params.id as string;

  const [banner] = await db
    .select({ id: bannersTable.id, title: bannersTable.title })
    .from(bannersTable)
    .where(eq(bannersTable.id, id))
    .limit(1);

  if (!banner) { res.status(404).json({ error: "Banner not found" }); return; }

  await db.delete(bannersTable).where(eq(bannersTable.id, id));

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "banner_deleted",
    targetType: "banner",
    targetId: id,
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, bannerId: id }, "Banner deleted");
  res.json({ success: true, message: "Banner deleted" });
});

export default router;
