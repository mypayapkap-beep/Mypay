import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  withdrawalsTable,
  upiAccountsTable,
  walletsTable,
  profilesTable,
} from "@workspace/db";
import { eq, and, desc, lt, isNull } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { debitWallet, generateIdempotencyKey } from "../lib/wallet";
import { logFraudCheck } from "../lib/fraud";

const router: IRouter = Router();

const WithdrawalBody = z.object({
  amount: z.number().min(100).max(10000),
  upiAccountId: z.string().uuid(),
  idempotencyKey: z.string().optional(),
});

router.post(
  "/withdrawals",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = WithdrawalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { amount, upiAccountId, idempotencyKey } = parsed.data;
    const key = idempotencyKey ?? generateIdempotencyKey();

    const [upiAccount] = await db
      .select()
      .from(upiAccountsTable)
      .where(
        and(
          eq(upiAccountsTable.id, upiAccountId),
          eq(upiAccountsTable.userId, req.user.id),
          eq(upiAccountsTable.status, "approved"),
          isNull(upiAccountsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!upiAccount) {
      res.status(400).json({ error: "UPI account not found or not approved" });
      return;
    }

    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, req.user.id))
      .limit(1);

    if (!wallet) {
      res.status(400).json({ error: "Wallet not found" });
      return;
    }

    if (parseFloat(wallet.inrBalance) < amount) {
      res.status(400).json({ error: "Insufficient wallet balance" });
      return;
    }

    if (wallet.isFrozen) {
      res.status(400).json({ error: "Wallet is frozen" });
      return;
    }

    // Prevent duplicate pending sell requests
    const [existingPending] = await db
      .select({ id: withdrawalsTable.id })
      .from(withdrawalsTable)
      .where(
        and(
          eq(withdrawalsTable.userId, req.user.id),
          eq(withdrawalsTable.status, "pending"),
        ),
      )
      .limit(1);

    if (existingPending) {
      res.status(400).json({ error: "You already have a pending sell request. Please wait for it to be processed before submitting a new one." });
      return;
    }

    // Snapshot user's current sell UPI at time of withdrawal
    const [profile] = await db
      .select({ sellUpiId: profilesTable.sellUpiId })
      .from(profilesTable)
      .where(eq(profilesTable.id, req.user.id))
      .limit(1);

    const userSellUpi = profile?.sellUpiId ?? null;

    try {
      await debitWallet({
        userId: req.user.id,
        amount: amount.toFixed(2),
        currency: "INR",
        type: "withdrawal",
        description: `Withdrawal to ${upiAccount.upiId}`,
        idempotencyKey: key,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message ?? "Failed to process withdrawal" });
      return;
    }

    const [withdrawal] = await db
      .insert(withdrawalsTable)
      .values({
        userId: req.user.id,
        amount: amount.toFixed(2),
        upiAccountId,
        status: "pending",
        userSellUpi,
        idempotencyKey: key,
      })
      .returning();

    await logFraudCheck({
      userId: req.user.id,
      eventType: "withdrawal_requested",
      referenceId: withdrawal.id,
      referenceType: "withdrawal",
      riskScore: 10,
      metadata: { amount, upiId: upiAccount.upiId },
    });

    req.log.info(
      { userId: req.user.id, withdrawalId: withdrawal.id, amount },
      "Withdrawal requested",
    );

    res.status(201).json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        upiId: upiAccount.upiId,
        createdAt: withdrawal.createdAt,
      },
    });
  },
);

router.get(
  "/withdrawals",
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

    const conditions = [eq(withdrawalsTable.userId, req.user.id)];
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
        upiId: upiAccountsTable.upiId,
        accountHolderName: upiAccountsTable.accountHolderName,
      })
      .from(withdrawalsTable)
      .leftJoin(upiAccountsTable, eq(withdrawalsTable.upiAccountId, upiAccountsTable.id))
      .where(and(...conditions))
      .orderBy(desc(withdrawalsTable.createdAt))
      .limit(limit + 1);

    const hasMore = withdrawals.length > limit;
    const items = hasMore ? withdrawals.slice(0, limit) : withdrawals;

    res.json({
      withdrawals: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

export default router;
