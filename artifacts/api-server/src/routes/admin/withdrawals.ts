import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  withdrawalsTable,
  profilesTable,
  upiAccountsTable,
  adminLogsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, desc, lt } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { creditWallet } from "../../lib/wallet";

const router: IRouter = Router();

// GET /api/admin/withdrawals — list all withdrawals
router.get("/withdrawals", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    status: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, before, status } = parsed.data;

  const conditions: any[] = [];
  if (status) conditions.push(eq(withdrawalsTable.status, status));
  if (before) conditions.push(lt(withdrawalsTable.createdAt, new Date(before)));

  const withdrawals = await db
    .select({
      id: withdrawalsTable.id,
      amount: withdrawalsTable.amount,
      status: withdrawalsTable.status,
      adminNotes: withdrawalsTable.adminNotes,
      processedAt: withdrawalsTable.processedAt,
      rejectedReason: withdrawalsTable.rejectedReason,
      createdAt: withdrawalsTable.createdAt,
      userId: withdrawalsTable.userId,
      userName: profilesTable.name,
      userMobile: profilesTable.mobile,
      userSellUpi: withdrawalsTable.userSellUpi,
      profileSellUpiId: profilesTable.sellUpiId,
      upiId: upiAccountsTable.upiId,
      accountHolderName: upiAccountsTable.accountHolderName,
      provider: upiAccountsTable.provider,
    })
    .from(withdrawalsTable)
    .leftJoin(profilesTable, eq(withdrawalsTable.userId, profilesTable.id))
    .leftJoin(upiAccountsTable, eq(withdrawalsTable.upiAccountId, upiAccountsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(limit + 1);

  const hasMore = withdrawals.length > limit;
  const items = hasMore ? withdrawals.slice(0, limit) : withdrawals;

  res.json({
    withdrawals: items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
  });
});

// PATCH /api/admin/withdrawals/:id/process — mark as processed
router.patch(
  "/withdrawals/:id/process",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    const schema = z.object({
      adminNotes: z.string().max(500).optional(),
      utrNumber: z.string().min(6).max(50).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [withdrawal] = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.id, (req.params.id as string)))
      .limit(1);

    if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }
    if (withdrawal.status !== "pending") {
      res.status(400).json({ error: `Withdrawal is already ${withdrawal.status}` });
      return;
    }

    await db
      .update(withdrawalsTable)
      .set({
        status: "processed",
        adminNotes: parsed.data.adminNotes,
        processedBy: req.adminUser.id,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawalsTable.id, withdrawal.id));

    await db.insert(notificationsTable).values({
      userId: withdrawal.userId,
      category: "withdrawal",
      title: "Withdrawal Processed",
      message: `Your withdrawal of ₹${withdrawal.amount} has been processed successfully.`,
      referenceId: withdrawal.id,
      referenceType: "withdrawal",
    });

    await db.insert(adminLogsTable).values({
      adminId: req.adminUser.id,
      action: "withdrawal_processed",
      targetType: "withdrawal",
      targetId: withdrawal.id,
      ipAddress: req.ip,
    });

    req.log.info({ adminId: req.adminUser.id, withdrawalId: withdrawal.id }, "Withdrawal processed");
    res.json({ success: true, message: "Withdrawal marked as processed" });
  },
);

// PATCH /api/admin/withdrawals/:id/reject — reject and refund
router.patch(
  "/withdrawals/:id/reject",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    const schema = z.object({ reason: z.string().min(5).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [withdrawal] = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.id, (req.params.id as string)))
      .limit(1);

    if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }
    if (withdrawal.status !== "pending") {
      res.status(400).json({ error: `Withdrawal is already ${withdrawal.status}` });
      return;
    }

    // Refund the deducted amount back to wallet
    await creditWallet({
      userId: withdrawal.userId,
      amount: withdrawal.amount,
      currency: "INR",
      type: "withdrawal_refund",
      referenceId: withdrawal.id,
      description: `Withdrawal rejected — refunded. Reason: ${parsed.data.reason}`,
      idempotencyKey: `withdrawal_refund_${withdrawal.id}`,
    });

    await db
      .update(withdrawalsTable)
      .set({
        status: "rejected",
        rejectedReason: parsed.data.reason,
        processedBy: req.adminUser.id,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawalsTable.id, withdrawal.id));

    await db.insert(notificationsTable).values({
      userId: withdrawal.userId,
      category: "withdrawal",
      title: "Withdrawal Rejected & Refunded",
      message: `Your withdrawal of ₹${withdrawal.amount} was rejected and refunded. Reason: ${parsed.data.reason}`,
      referenceId: withdrawal.id,
      referenceType: "withdrawal",
    });

    await db.insert(adminLogsTable).values({
      adminId: req.adminUser.id,
      action: "withdrawal_rejected",
      targetType: "withdrawal",
      targetId: withdrawal.id,
      newValue: JSON.stringify({ reason: parsed.data.reason }),
      ipAddress: req.ip,
    });

    req.log.info({ adminId: req.adminUser.id, withdrawalId: withdrawal.id }, "Withdrawal rejected & refunded");
    res.json({ success: true, message: "Withdrawal rejected and amount refunded" });
  },
);

export default router;
