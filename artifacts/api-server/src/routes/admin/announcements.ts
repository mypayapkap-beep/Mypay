import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { announcementsTable, adminLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

const AnnouncementBody = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  type: z.enum(["info", "warning", "success", "error"]).default("info"),
  isPinned: z.boolean().default(false),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

// POST /api/admin/announcements — create announcement
router.post("/announcements", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = AnnouncementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { title, content, type, isPinned, startsAt, endsAt } = parsed.data;

  const [announcement] = await db
    .insert(announcementsTable)
    .values({
      title,
      content,
      type,
      isPinned,
      isActive: true,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      endsAt: endsAt ? new Date(endsAt) : undefined,
    })
    .returning();

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "announcement_created",
    targetType: "announcement",
    targetId: announcement.id,
    newValue: JSON.stringify({ title, isPinned }),
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, announcementId: announcement.id }, "Announcement created");
  res.status(201).json({ success: true, announcement });
});

// DELETE /api/admin/announcements/:id — delete announcement
router.delete("/announcements/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = req.params.id as string;

  const [announcement] = await db
    .select({ id: announcementsTable.id })
    .from(announcementsTable)
    .where(eq(announcementsTable.id, id))
    .limit(1);

  if (!announcement) { res.status(404).json({ error: "Announcement not found" }); return; }

  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "announcement_deleted",
    targetType: "announcement",
    targetId: id,
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, announcementId: id }, "Announcement deleted");
  res.json({ success: true, message: "Announcement deleted" });
});

export default router;
