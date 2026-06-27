import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sellRequestsTable } from "@workspace/db";
import { eq, and, desc, lt } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/sell-requests — list current user's sell requests
router.get(
  "/sell-requests",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      before: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const { limit, before } = parsed.data;

    const conditions: ReturnType<typeof eq>[] = [eq(sellRequestsTable.userId, req.user.id)];
    if (before) conditions.push(lt(sellRequestsTable.createdAt, new Date(before)));

    const rows = await db
      .select({
        id: sellRequestsTable.id,
        tokenAmount: sellRequestsTable.tokenAmount,
        sellAmount: sellRequestsTable.sellAmount,
        status: sellRequestsTable.status,
        approvedAt: sellRequestsTable.approvedAt,
        rejectedAt: sellRequestsTable.rejectedAt,
        adminNotes: sellRequestsTable.adminNotes,
        createdAt: sellRequestsTable.createdAt,
      })
      .from(sellRequestsTable)
      .where(and(...conditions))
      .orderBy(desc(sellRequestsTable.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const result = hasMore ? rows.slice(0, limit) : rows;

    res.json({ sellRequests: result, hasMore });
  },
);

export default router;
