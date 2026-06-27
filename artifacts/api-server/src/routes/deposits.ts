import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  depositsTable,
  buyOrdersTable,
  upiAccountsTable,
} from "@workspace/db";
import { eq, and, ne, desc, lt, or, sql, isNull, gte } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { generateIdempotencyKey } from "../lib/wallet";
import { logFraudCheck } from "../lib/fraud";

const router: IRouter = Router();

const TIMER_MINUTES = 30;

function isTimerExpired(timerStartedAt: Date | null | undefined): boolean {
  if (!timerStartedAt) return false;
  return Date.now() - timerStartedAt.getTime() > TIMER_MINUTES * 60 * 1000;
}

async function autoExpireDeposit(depositId: string): Promise<void> {
  await db
    .update(depositsTable)
    .set({
      status: "cancelled",
      cancelReason: "Timer expired",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(depositsTable.id, depositId),
        eq(depositsTable.status, "paying"),
      ),
    );
}

// POST /api/deposits — initiate a buy order (creates deposit with status="paying")
// If user already has a paying/pending_verification deposit for same buy order, returns existing
router.post(
  "/deposits",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = z.object({
      buyOrderId: z.string().uuid(),
      amount: z.number().min(100).max(56000),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      return;
    }

    const { buyOrderId, amount } = parsed.data;

    // Mandatory UPI check: user must have at least one approved, non-deleted UPI account
    const [upiAccount] = await db
      .select({ id: upiAccountsTable.id })
      .from(upiAccountsTable)
      .where(
        and(
          eq(upiAccountsTable.userId, req.user.id),
          eq(upiAccountsTable.status, "approved"),
          isNull(upiAccountsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!upiAccount) {
      req.log.warn({ userId: req.user.id }, "Deposit attempt blocked: no approved UPI account");
      res.status(400).json({
        error: "upi_required",
        message: "Please add and verify a UPI account before buying an order",
      });
      return;
    }

    // Validate buy order exists and is active
    const [buyOrder] = await db
      .select()
      .from(buyOrdersTable)
      .where(eq(buyOrdersTable.id, buyOrderId))
      .limit(1);

    if (!buyOrder || !buyOrder.isActive) {
      res.status(404).json({ error: "Buy order not found or not active" });
      return;
    }

    // Verify amount matches the buy order
    if (Math.abs(amount - parseFloat(buyOrder.amount)) > 0.01) {
      res.status(400).json({ error: `Amount must be exactly ₹${parseFloat(buyOrder.amount).toLocaleString("en-IN")}` });
      return;
    }

    // Check if user already has an open (paying/pending_verification) deposit for this buy order
    const [existingDeposit] = await db
      .select()
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.userId, req.user.id),
          eq(depositsTable.buyOrderId, buyOrderId),
          or(
            eq(depositsTable.status, "paying"),
            eq(depositsTable.status, "pending_verification"),
          ),
        ),
      )
      .limit(1);

    if (existingDeposit) {
      // If the existing deposit is paying and the timer has expired, auto-cancel it and fall through
      if (existingDeposit.status === "paying" && isTimerExpired(existingDeposit.timerStartedAt)) {
        req.log.info({ userId: req.user.id, depositId: existingDeposit.id }, "Existing deposit timer expired — auto-cancelling");
        await autoExpireDeposit(existingDeposit.id);
        // Fall through to create a fresh deposit below
      } else {
        req.log.info({ userId: req.user.id, depositId: existingDeposit.id }, "Returning existing open deposit");
        res.json({
          success: true,
          isExisting: true,
          deposit: {
            id: existingDeposit.id,
            amount: existingDeposit.amount,
            status: existingDeposit.status,
            screenshotUrl: existingDeposit.screenshotUrl,
            utrNumber: existingDeposit.utrNumber,
            timerStartedAt: existingDeposit.timerStartedAt,
            createdAt: existingDeposit.createdAt,
            buyOrder: {
              id: buyOrder.id,
              title: buyOrder.title,
              paymentMethod: buyOrder.paymentMethod,
              upiId: buyOrder.upiId,
              name: buyOrder.name,
              accountNumber: buyOrder.accountNumber,
              ifscCode: buyOrder.ifscCode,
              amount: buyOrder.amount,
            },
          },
        });
        return;
      }
    }

    // Check slots: count non-rejected, non-cancelled claims for this buy order
    const [claimRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.buyOrderId, buyOrderId),
          ne(depositsTable.status, "rejected"),
          ne(depositsTable.status, "cancelled"),
        ),
      );

    const currentClaims = claimRow?.count ?? 0;
    if (currentClaims >= buyOrder.maxClaims) {
      res.status(409).json({ error: "This order has already been fully claimed" });
      return;
    }

    // Create deposit with status="paying" and start the timer
    const key = generateIdempotencyKey();
    const now = new Date();
    const [deposit] = await db
      .insert(depositsTable)
      .values({
        userId: req.user.id,
        buyOrderId,
        amount: buyOrder.amount,
        utrNumber: null,
        paymentMethod: "upi",
        screenshotUrl: null,
        status: "paying",
        idempotencyKey: key,
        timerStartedAt: now,
      })
      .returning();

    await logFraudCheck({
      userId: req.user.id,
      eventType: "deposit_submitted",
      referenceId: deposit.id,
      referenceType: "deposit",
      riskScore: 0,
      metadata: { amount, buyOrderId },
    });

    req.log.info({ userId: req.user.id, depositId: deposit.id, amount }, "Buy order deposit initiated (paying)");

    res.status(201).json({
      success: true,
      isExisting: false,
      deposit: {
        id: deposit.id,
        amount: deposit.amount,
        status: deposit.status,
        screenshotUrl: null,
        utrNumber: null,
        timerStartedAt: deposit.timerStartedAt,
        createdAt: deposit.createdAt,
        buyOrder: {
          id: buyOrder.id,
          title: buyOrder.title,
          paymentMethod: buyOrder.paymentMethod,
          upiId: buyOrder.upiId,
          name: buyOrder.name,
          accountNumber: buyOrder.accountNumber,
          ifscCode: buyOrder.ifscCode,
          amount: buyOrder.amount,
        },
      },
    });
  },
);

// POST /api/deposits/:id/confirm — user confirms payment by uploading screenshot
// Moves status: paying → pending_verification
router.post(
  "/deposits/:id/confirm",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = z.object({
      screenshotUrl: z.string().min(1, "Screenshot is required"),
      utrNumber: z.string().max(100).trim().optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      return;
    }

    const [deposit] = await db
      .select()
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.id, req.params.id as string),
          eq(depositsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!deposit) { res.status(404).json({ error: "Order not found" }); return; }

    if (deposit.status !== "paying") {
      res.status(400).json({ error: `Order status is "${deposit.status}" — cannot confirm` });
      return;
    }

    // Block confirmation if timer has expired
    if (isTimerExpired(deposit.timerStartedAt)) {
      await autoExpireDeposit(deposit.id);
      res.status(400).json({ error: "timer_expired", message: "Order timer has expired. Please start a new order." });
      return;
    }

    await db
      .update(depositsTable)
      .set({
        status: "pending_verification",
        screenshotUrl: parsed.data.screenshotUrl,
        utrNumber: parsed.data.utrNumber ?? null,
        updatedAt: new Date(),
      })
      .where(eq(depositsTable.id, deposit.id));

    req.log.info({ userId: req.user.id, depositId: deposit.id }, "Deposit confirmed by user — pending_verification");

    res.json({ success: true, message: "Order submitted for admin review" });
  },
);

// POST /api/deposits/:id/cancel — user cancels a paying or pending_verification order
router.post(
  "/deposits/:id/cancel",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = z.object({
      reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      return;
    }

    const [deposit] = await db
      .select()
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.id, req.params.id as string),
          eq(depositsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!deposit) { res.status(404).json({ error: "Order not found" }); return; }

    if (!["paying", "pending_verification"].includes(deposit.status)) {
      res.status(400).json({ error: `Cannot cancel order with status "${deposit.status}"` });
      return;
    }

    // Enforce max 10 user-initiated cancellations per day (timer-expired auto-cancels don't count)
    if (parsed.data.reason !== "Timer expired") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [cancelRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(depositsTable)
        .where(
          and(
            eq(depositsTable.userId, req.user.id),
            eq(depositsTable.status, "cancelled"),
            ne(depositsTable.cancelReason, "Timer expired"),
            gte(depositsTable.cancelledAt, startOfToday),
          ),
        );

      const todayCount = cancelRow?.count ?? 0;
      if (todayCount >= 10) {
        res.status(429).json({
          error: "Daily buy order cancellation limit reached. Please try again tomorrow.",
        });
        return;
      }
    }

    await db
      .update(depositsTable)
      .set({
        status: "cancelled",
        cancelReason: parsed.data.reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(depositsTable.id, deposit.id));

    req.log.info({ userId: req.user.id, depositId: deposit.id, reason: parsed.data.reason }, "Deposit cancelled by user");

    res.json({ success: true, message: "Order cancelled" });
  },
);

// GET /api/deposits — list my deposits (with buy order UPI details for paying status)
router.get(
  "/deposits",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      before: z.string().optional(),
      status: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const { limit, before, status } = parsed.data;

    const conditions = [eq(depositsTable.userId, req.user.id)];
    if (status) conditions.push(eq(depositsTable.status, status));
    if (before) conditions.push(lt(depositsTable.createdAt, new Date(before)));

    const deposits = await db
      .select({
        id: depositsTable.id,
        amount: depositsTable.amount,
        utrNumber: depositsTable.utrNumber,
        paymentMethod: depositsTable.paymentMethod,
        buyOrderId: depositsTable.buyOrderId,
        status: depositsTable.status,
        adminNotes: depositsTable.adminNotes,
        screenshotUrl: depositsTable.screenshotUrl,
        cancelReason: depositsTable.cancelReason,
        approvedAt: depositsTable.approvedAt,
        timerStartedAt: depositsTable.timerStartedAt,
        createdAt: depositsTable.createdAt,
        buyOrderTitle: buyOrdersTable.title,
        buyOrderPaymentMethod: buyOrdersTable.paymentMethod,
        buyOrderUpiId: buyOrdersTable.upiId,
        buyOrderName: buyOrdersTable.name,
        buyOrderAccountNumber: buyOrdersTable.accountNumber,
        buyOrderIfscCode: buyOrdersTable.ifscCode,
        buyOrderAmount: buyOrdersTable.amount,
      })
      .from(depositsTable)
      .leftJoin(buyOrdersTable, eq(depositsTable.buyOrderId, buyOrdersTable.id))
      .where(and(...conditions))
      .orderBy(desc(depositsTable.createdAt))
      .limit(limit + 1);

    // Auto-expire any paying deposits whose timer has run out
    const expiredIds = deposits
      .filter((d) => d.status === "paying" && isTimerExpired(d.timerStartedAt))
      .map((d) => d.id);

    if (expiredIds.length > 0) {
      await Promise.all(expiredIds.map(autoExpireDeposit));
      // Update the in-memory records so the response is correct
      for (const d of deposits) {
        if (expiredIds.includes(d.id)) {
          d.status = "cancelled";
          (d as any).cancelReason = "Timer expired";
        }
      }
    }

    const hasMore = deposits.length > limit;
    const items = hasMore ? deposits.slice(0, limit) : deposits;

    res.json({
      deposits: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

// GET /api/deposits/:id — get single deposit
router.get(
  "/deposits/:id",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [row] = await db
      .select({
        id: depositsTable.id,
        amount: depositsTable.amount,
        utrNumber: depositsTable.utrNumber,
        paymentMethod: depositsTable.paymentMethod,
        buyOrderId: depositsTable.buyOrderId,
        status: depositsTable.status,
        adminNotes: depositsTable.adminNotes,
        screenshotUrl: depositsTable.screenshotUrl,
        cancelReason: depositsTable.cancelReason,
        approvedAt: depositsTable.approvedAt,
        timerStartedAt: depositsTable.timerStartedAt,
        createdAt: depositsTable.createdAt,
        buyOrderTitle: buyOrdersTable.title,
        buyOrderPaymentMethod: buyOrdersTable.paymentMethod,
        buyOrderUpiId: buyOrdersTable.upiId,
        buyOrderName: buyOrdersTable.name,
        buyOrderAccountNumber: buyOrdersTable.accountNumber,
        buyOrderIfscCode: buyOrdersTable.ifscCode,
        buyOrderAmount: buyOrdersTable.amount,
      })
      .from(depositsTable)
      .leftJoin(buyOrdersTable, eq(depositsTable.buyOrderId, buyOrdersTable.id))
      .where(
        and(
          eq(depositsTable.id, req.params.id as string),
          eq(depositsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!row) { res.status(404).json({ error: "Deposit not found" }); return; }

    // Auto-expire if timer ran out
    if (row.status === "paying" && isTimerExpired(row.timerStartedAt)) {
      await autoExpireDeposit(row.id);
      row.status = "cancelled";
      (row as any).cancelReason = "Timer expired";
    }

    res.json({ deposit: row });
  },
);

export default router;
