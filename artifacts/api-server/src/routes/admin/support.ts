import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { supportTicketsTable, profilesTable, adminLogsTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, lt } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/admin/support — list all tickets
router.get("/support", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    status: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, before, status } = parsed.data;
  const conditions: any[] = [];
  if (status) conditions.push(eq(supportTicketsTable.status, status));
  if (before) conditions.push(lt(supportTicketsTable.createdAt, new Date(before)));

  const tickets = await db
    .select({
      id: supportTicketsTable.id,
      subject: supportTicketsTable.subject,
      message: supportTicketsTable.message,
      status: supportTicketsTable.status,
      attachmentUrl: supportTicketsTable.attachmentUrl,
      adminResponse: supportTicketsTable.adminResponse,
      resolvedAt: supportTicketsTable.resolvedAt,
      createdAt: supportTicketsTable.createdAt,
      userId: supportTicketsTable.userId,
      userName: profilesTable.name,
      userMobile: profilesTable.mobile,
    })
    .from(supportTicketsTable)
    .leftJoin(profilesTable, eq(supportTicketsTable.userId, profilesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(limit + 1);

  const hasMore = tickets.length > limit;
  const items = hasMore ? tickets.slice(0, limit) : tickets;
  res.json({ tickets: items, hasMore });
});

// PATCH /api/admin/support/:id/respond
router.patch("/support/:id/respond", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({
    response: z.string().min(5).max(2000),
    status: z.enum(["open", "in_progress", "resolved", "closed"]).default("resolved"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const id = req.params.id as string;

  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  await db
    .update(supportTicketsTable)
    .set({
      adminResponse: parsed.data.response,
      status: parsed.data.status,
      assignedTo: req.adminUser.id,
      resolvedAt: parsed.data.status === "resolved" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(supportTicketsTable.id, id));

  await db.insert(notificationsTable).values({
    userId: ticket.userId,
    category: "support",
    title: "Support Ticket Updated",
    message: `Your ticket "${ticket.subject}" has been updated: ${parsed.data.response.slice(0, 100)}`,
    referenceId: id,
    referenceType: "support_ticket",
  });

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "support_ticket_responded",
    targetType: "support_ticket",
    targetId: id,
    newValue: JSON.stringify({ status: parsed.data.status }),
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "Response sent" });
});

export default router;
