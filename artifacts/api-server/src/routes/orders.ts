import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { buyOrdersTable, depositsTable } from "@workspace/db";
import { eq, and, ne, sql, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/orders — list active buy orders that still have available slots
router.get(
  "/orders",
  requireAuth as any,
  async (_req: AuthenticatedRequest, res): Promise<void> => {
    const orders = await db
      .select()
      .from(buyOrdersTable)
      .where(eq(buyOrdersTable.isActive, true))
      .orderBy(desc(buyOrdersTable.createdAt));

    // For each order, count active (non-rejected, non-cancelled) claims to determine availability.
    // Cancelled/expired deposits free the slot so other users can claim it.
    const result = await Promise.all(
      orders.map(async (order) => {
        const [claimRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(depositsTable)
          .where(
            and(
              eq(depositsTable.buyOrderId, order.id),
              ne(depositsTable.status, "rejected"),
              ne(depositsTable.status, "cancelled"),
            ),
          );
        const claims = claimRow?.count ?? 0;
        return {
          id: order.id,
          title: order.title,
          amount: order.amount,
          paymentMethod: order.paymentMethod,
          upiId: order.upiId,
          name: order.name,
          accountNumber: order.accountNumber,
          ifscCode: order.ifscCode,
          description: order.description,
          isActive: order.isActive,
          maxClaims: order.maxClaims,
          remainingSlots: order.maxClaims - claims,
          createdAt: order.createdAt,
        };
      }),
    );

    // Only return orders with remaining slots
    const available = result.filter((o) => o.remainingSlots > 0);

    res.json({ orders: available });
  },
);

export default router;
