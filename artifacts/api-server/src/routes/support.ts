import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { supportTicketsTable } from "@workspace/db";
import { eq, and, desc, lt } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const CreateTicketBody = z.object({
  subject: z.string().min(5).max(200).trim(),
  message: z.string().min(10).max(2000).trim(),
  attachmentUrl: z.string().url().optional(),
});

// POST /api/support — create a ticket
router.post(
  "/support",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = CreateTicketBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { subject, message, attachmentUrl } = parsed.data;

    const [ticket] = await db
      .insert(supportTicketsTable)
      .values({
        userId: req.user.id,
        subject,
        message,
        attachmentUrl,
        status: "open",
      })
      .returning();

    req.log.info({ userId: req.user.id, ticketId: ticket.id }, "Support ticket created");

    res.status(201).json({
      success: true,
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        message: ticket.message,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  },
);

// GET /api/support — list my tickets
router.get(
  "/support",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      before: z.string().optional(),
      status: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit, before, status } = parsed.data;

    const conditions = [eq(supportTicketsTable.userId, req.user.id)];
    if (status) conditions.push(eq(supportTicketsTable.status, status));
    if (before) conditions.push(lt(supportTicketsTable.createdAt, new Date(before)));

    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .where(and(...conditions))
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(limit + 1);

    const hasMore = tickets.length > limit;
    const items = hasMore ? tickets.slice(0, limit) : tickets;

    res.json({
      tickets: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

// GET /api/support/:id — get a ticket
router.get(
  "/support/:id",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.id, (req.params.id as string)),
          eq(supportTicketsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json({ ticket });
  },
);

export default router;
