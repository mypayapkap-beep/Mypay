import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  settingsTable,
  adminLogsTable,
  bannersTable,
  announcementsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/admin/settings
router.get("/settings", async (req: AuthenticatedRequest, res): Promise<void> => {
  const settings = await db.select().from(settingsTable).orderBy(settingsTable.key);
  res.json({ settings });
});

// PATCH /api/admin/settings/:key
router.patch("/settings/:key", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({ value: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, (req.params.key as string)))
    .limit(1);

  if (!setting) { res.status(404).json({ error: "Setting not found" }); return; }

  await db
    .update(settingsTable)
    .set({ value: parsed.data.value, updatedBy: req.adminUser.id, updatedAt: new Date() })
    .where(eq(settingsTable.key, (req.params.key as string)));

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "setting_updated",
    targetType: "setting",
    targetId: (req.params.key as string),
    previousValue: setting.value,
    newValue: parsed.data.value,
    ipAddress: req.ip,
  });

  res.json({ success: true, key: (req.params.key as string), value: parsed.data.value });
});

// POST /api/admin/banners
router.post("/banners", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({
    title: z.string().min(2).max(200),
    imageUrl: z.string().url(),
    linkUrl: z.string().url().optional(),
    sortOrder: z.number().int().default(0),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [banner] = await db
    .insert(bannersTable)
    .values({
      ...parsed.data,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
    })
    .returning();

  res.status(201).json({ success: true, banner });
});

// DELETE /api/admin/banners/:id
router.delete("/banners/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  await db
    .update(bannersTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(bannersTable.id, (req.params.id as string)));

  res.json({ success: true, message: "Banner deactivated" });
});

// POST /api/admin/announcements
router.post("/announcements", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({
    title: z.string().min(2).max(200),
    content: z.string().min(5).max(5000),
    type: z.enum(["info", "warning", "success", "error"]).default("info"),
    isPinned: z.boolean().default(false),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [announcement] = await db
    .insert(announcementsTable)
    .values({
      ...parsed.data,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
    })
    .returning();

  res.status(201).json({ success: true, announcement });
});

// DELETE /api/admin/announcements/:id
router.delete(
  "/announcements/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    await db
      .update(announcementsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(announcementsTable.id, (req.params.id as string)));

    res.json({ success: true, message: "Announcement deactivated" });
  },
);

// GET /api/admin/logs — admin action log
router.get("/logs", async (req: AuthenticatedRequest, res): Promise<void> => {
  const { adminLogsTable: logs, adminUsersTable } = await import("@workspace/db");
  const { count } = await import("drizzle-orm");

  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    action: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, before, action } = parsed.data;

  const conditions: any[] = [];
  if (action) conditions.push(eq(logs.action, action));
  if (before) {
    const { lt: ltFn } = await import("drizzle-orm");
    conditions.push(ltFn(logs.createdAt, new Date(before)));
  }

  const { desc: descFn, and: andFn } = await import("drizzle-orm");

  const entries = await db
    .select({
      id: logs.id,
      adminId: logs.adminId,
      action: logs.action,
      targetType: logs.targetType,
      targetId: logs.targetId,
      previousValue: logs.previousValue,
      newValue: logs.newValue,
      ipAddress: logs.ipAddress,
      createdAt: logs.createdAt,
      adminName: adminUsersTable.name,
    })
    .from(logs)
    .leftJoin(adminUsersTable, eq(logs.adminId, adminUsersTable.id))
    .where(conditions.length > 0 ? andFn(...conditions) : undefined)
    .orderBy(descFn(logs.createdAt))
    .limit(limit + 1);

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, limit) : entries;

  res.json({ logs: items, hasMore });
});

export default router;
