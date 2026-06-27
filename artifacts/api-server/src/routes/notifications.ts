import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc, lt } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/notifications
router.get(
  "/notifications",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      before: z.string().optional(),
      unreadOnly: z.coerce.boolean().optional(),
      category: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit, before, unreadOnly, category } = parsed.data;

    const conditions = [eq(notificationsTable.userId, req.user.id)];
    if (unreadOnly) conditions.push(eq(notificationsTable.isRead, false));
    if (category) conditions.push(eq(notificationsTable.category, category));
    if (before) conditions.push(lt(notificationsTable.createdAt, new Date(before)));

    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit + 1);

    // Get unread count
    const unreadCount = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, req.user.id),
          eq(notificationsTable.isRead, false),
        ),
      );

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;

    res.json({
      notifications: items,
      unreadCount: unreadCount.length,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

// PATCH /api/notifications/:id/read — mark as read
router.patch(
  "/notifications/:id/read",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [notification] = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.id, (req.params.id as string)),
          eq(notificationsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notificationsTable.id, notification.id));

    res.json({ success: true });
  },
);

// PATCH /api/notifications/read-all — mark all as read
router.patch(
  "/notifications/read-all",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.userId, req.user.id),
          eq(notificationsTable.isRead, false),
        ),
      );

    res.json({ success: true, message: "All notifications marked as read" });
  },
);

export default router;
