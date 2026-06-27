import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  depositsTable,
  profilesTable,
  buyOrdersTable,
  adminLogsTable,
  notificationsTable,
  referralsTable,
  settingsTable,
} from "@workspace/db";
import { eq, and, desc, lt, sum, inArray, ne, gte, sql } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { creditWallet } from "../../lib/wallet";

const router: IRouter = Router();

async function getBonusRate(): Promise<number> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "income_percentage"))
    .limit(1);
  const pct = parseFloat(row?.value ?? "5");
  return isNaN(pct) ? 0.05 : pct / 100;
}

async function getCommissionSettings() {
  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(
      inArray(settingsTable.key, [
        "referral_commission_level_a",
        "referral_commission_level_b",
        "referral_direct_reward",
        "referral_volume_threshold",
      ]),
    );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    levelARate: parseFloat(map["referral_commission_level_a"] ?? "0.3") / 100,
    levelBRate: parseFloat(map["referral_commission_level_b"] ?? "0.1") / 100,
    rewardAmount: map["referral_direct_reward"] ?? "200.00",
    volumeThreshold: parseFloat(map["referral_volume_threshold"] ?? "5000"),
  };
}

async function safeCreditCommission(params: Parameters<typeof creditWallet>[0]) {
  try {
    await creditWallet(params);
  } catch (err: any) {
    if (
      err?.code === "23505" ||
      err?.message?.includes("idempotency") ||
      err?.message?.includes("unique")
    ) {
      return;
    }
    throw err;
  }
}

router.get("/deposits", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    status: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, before, status } = parsed.data;

  const conditions: any[] = [];
  if (status) conditions.push(eq(depositsTable.status, status));
  if (before) conditions.push(lt(depositsTable.createdAt, new Date(before)));

  const deposits = await db
    .select({
      id: depositsTable.id,
      amount: depositsTable.amount,
      utrNumber: depositsTable.utrNumber,
      paymentMethod: depositsTable.paymentMethod,
      screenshotUrl: depositsTable.screenshotUrl,
      status: depositsTable.status,
      adminNotes: depositsTable.adminNotes,
      approvedAt: depositsTable.approvedAt,
      cancelReason: depositsTable.cancelReason,
      cancelledAt: depositsTable.cancelledAt,
      createdAt: depositsTable.createdAt,
      userId: depositsTable.userId,
      buyOrderId: depositsTable.buyOrderId,
      userName: profilesTable.name,
      userMobile: profilesTable.mobile,
      userSellUpiId: profilesTable.sellUpiId,
      buyOrderTitle: buyOrdersTable.title,
    })
    .from(depositsTable)
    .leftJoin(profilesTable, eq(depositsTable.userId, profilesTable.id))
    .leftJoin(buyOrdersTable, eq(depositsTable.buyOrderId, buyOrdersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(depositsTable.createdAt))
    .limit(limit + 1);

  const hasMore = deposits.length > limit;
  const items = hasMore ? deposits.slice(0, limit) : deposits;

  res.json({
    deposits: items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
  });
});

// GET /api/admin/deposits/cancellations — daily cancellation history (user-initiated only)
router.get("/deposits/cancellations", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    date: z.string().optional(), // YYYY-MM-DD, defaults to today
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, date } = parsed.data;

  const targetDate = date ? new Date(`${date}T00:00:00`) : new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      id: depositsTable.id,
      amount: depositsTable.amount,
      cancelReason: depositsTable.cancelReason,
      cancelledAt: depositsTable.cancelledAt,
      createdAt: depositsTable.createdAt,
      userId: depositsTable.userId,
      userName: profilesTable.name,
      userMobile: profilesTable.mobile,
      buyOrderTitle: buyOrdersTable.title,
    })
    .from(depositsTable)
    .leftJoin(profilesTable, eq(depositsTable.userId, profilesTable.id))
    .leftJoin(buyOrdersTable, eq(depositsTable.buyOrderId, buyOrdersTable.id))
    .where(
      and(
        eq(depositsTable.status, "cancelled"),
        ne(depositsTable.cancelReason, "Timer expired"),
        gte(depositsTable.cancelledAt, dayStart),
        lt(depositsTable.cancelledAt, dayEnd),
      ),
    )
    .orderBy(desc(depositsTable.cancelledAt))
    .limit(limit);

  // Aggregate per-user daily counts
  const userCounts: Record<string, number> = {};
  for (const r of rows) {
    userCounts[r.userId] = (userCounts[r.userId] ?? 0) + 1;
  }

  const result = rows.map((r) => ({
    ...r,
    todayCount: userCounts[r.userId] ?? 1,
    atLimit: (userCounts[r.userId] ?? 1) >= 10,
  }));

  res.json({ cancellations: result, date: dayStart.toISOString().split("T")[0], total: result.length });
});

router.patch(
  "/deposits/:id/approve",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    const schema = z.object({ adminNotes: z.string().max(500).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [deposit] = await db
      .select()
      .from(depositsTable)
      .where(eq(depositsTable.id, (req.params.id as string)))
      .limit(1);

    if (!deposit) { res.status(404).json({ error: "Deposit not found" }); return; }
    if (deposit.status !== "pending" && deposit.status !== "pending_verification") {
      res.status(400).json({ error: `Deposit is already ${deposit.status}` });
      return;
    }

    const baseAmount = parseFloat(deposit.amount);
    const isBuyOrder = !!deposit.buyOrderId;
    const bonusRate = await getBonusRate();
    const bonusPct = (bonusRate * 100).toFixed(2).replace(/\.?0+$/, "");
    const creditAmount = isBuyOrder
      ? (baseAmount * (1 + bonusRate)).toFixed(2)
      : deposit.amount;

    const incomeAmount = isBuyOrder ? (baseAmount * bonusRate).toFixed(2) : "0.00";

    const description = isBuyOrder
      ? `Buy order approved — ₹${baseAmount.toFixed(2)} + ${bonusPct}% income ₹${incomeAmount} = ₹${creditAmount} tokens`
      : `Deposit approved${deposit.utrNumber ? ` — UTR: ${deposit.utrNumber}` : ""}`;

    try {
      await creditWallet({
        userId: deposit.userId,
        amount: creditAmount,
        currency: "INR",
        type: "deposit",
        referenceId: deposit.id,
        description,
        idempotencyKey: `deposit_approve_${deposit.id}`,
      });
    } catch (err: any) {
      if (err?.code === "23505" || err?.message?.includes("idempotency_key") || err?.message?.includes("unique")) {
        res.status(409).json({ error: "This deposit has already been credited. Please refresh." });
        return;
      }
      throw err;
    }

    await db
      .update(depositsTable)
      .set({
        status: "approved",
        adminNotes: parsed.data.adminNotes,
        approvedBy: req.adminUser.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(depositsTable.id, deposit.id));

    // Team commissions — read rates from settings
    if (isBuyOrder && baseAmount > 0) {
      const { levelARate, levelBRate, rewardAmount, volumeThreshold } = await getCommissionSettings();

      const [directRef] = await db
        .select({ referrerId: referralsTable.referrerId, id: referralsTable.id, rewardStatus: referralsTable.rewardStatus })
        .from(referralsTable)
        .where(eq(referralsTable.referredId, deposit.userId))
        .limit(1);

      if (directRef) {
        const levelACommission = (baseAmount * levelARate).toFixed(2);
        if (parseFloat(levelACommission) >= 0.01) {
          await safeCreditCommission({
            userId: directRef.referrerId,
            amount: levelACommission,
            currency: "INR",
            type: "team_commission",
            referenceId: deposit.id,
            description: `Team commission Level A — ${(levelARate * 100).toFixed(1)}% of ₹${baseAmount.toFixed(2)}`,
            idempotencyKey: `commission_${deposit.id}_LA`,
          });
        }

        const [levelBRef] = await db
          .select({ referrerId: referralsTable.referrerId })
          .from(referralsTable)
          .where(eq(referralsTable.referredId, directRef.referrerId))
          .limit(1);

        if (levelBRef) {
          const levelBCommission = (baseAmount * levelBRate).toFixed(2);
          if (parseFloat(levelBCommission) >= 0.01) {
            await safeCreditCommission({
              userId: levelBRef.referrerId,
              amount: levelBCommission,
              currency: "INR",
              type: "team_commission",
              referenceId: deposit.id,
              description: `Team commission Level B — ${(levelBRate * 100).toFixed(1)}% of ₹${baseAmount.toFixed(2)}`,
              idempotencyKey: `commission_${deposit.id}_LB`,
            });
          }
        }

        if (directRef.rewardStatus === "pending") {
          const [volumeResult] = await db
            .select({ total: sum(depositsTable.amount) })
            .from(depositsTable)
            .where(and(
              eq(depositsTable.userId, deposit.userId),
              eq(depositsTable.status, "approved"),
            ));

          const totalVolume = parseFloat(volumeResult?.total ?? "0");
          if (totalVolume >= volumeThreshold) {
            await db.update(referralsTable)
              .set({ rewardStatus: "eligible", rewardAmount: rewardAmount })
              .where(eq(referralsTable.id, directRef.id));
          }
        }
      }
    }

    const notifyMsg = isBuyOrder
      ? `Your buy order of ₹${baseAmount.toFixed(2)} was approved! ₹${creditAmount} tokens credited (includes ${bonusPct}% income ₹${incomeAmount}).`
      : `Your deposit of ₹${deposit.amount} has been approved and credited to your wallet.`;

    await db.insert(notificationsTable).values({
      userId: deposit.userId,
      category: "deposit",
      title: isBuyOrder ? "Buy Order Approved" : "Deposit Approved",
      message: notifyMsg,
      referenceId: deposit.id,
      referenceType: "deposit",
    });

    await db.insert(adminLogsTable).values({
      adminId: req.adminUser.id,
      action: "deposit_approved",
      targetType: "deposit",
      targetId: deposit.id,
      newValue: JSON.stringify({ creditAmount, isBuyOrder }),
      ipAddress: req.ip,
    });

    req.log.info({ adminId: req.adminUser.id, depositId: deposit.id, creditAmount }, "Deposit approved");
    res.json({
      success: true,
      message: isBuyOrder
        ? `Buy order approved — ₹${creditAmount} tokens credited (${bonusPct}% bonus included)`
        : "Deposit approved and wallet credited",
    });
  },
);

router.patch(
  "/deposits/:id/reject",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    const schema = z.object({ reason: z.string().min(5).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [deposit] = await db
      .select()
      .from(depositsTable)
      .where(eq(depositsTable.id, (req.params.id as string)))
      .limit(1);

    if (!deposit) { res.status(404).json({ error: "Deposit not found" }); return; }
    if (deposit.status !== "pending" && deposit.status !== "pending_verification") {
      res.status(400).json({ error: `Deposit is already ${deposit.status}` });
      return;
    }

    await db
      .update(depositsTable)
      .set({
        status: "rejected",
        rejectedReason: parsed.data.reason,
        adminNotes: parsed.data.reason,
        approvedBy: req.adminUser.id,
        updatedAt: new Date(),
      })
      .where(eq(depositsTable.id, deposit.id));

    await db.insert(notificationsTable).values({
      userId: deposit.userId,
      category: "deposit",
      title: deposit.buyOrderId ? "Buy Order Rejected" : "Deposit Rejected",
      message: `Your ${deposit.buyOrderId ? "buy order" : "deposit"} of ₹${deposit.amount} was rejected. Reason: ${parsed.data.reason}`,
      referenceId: deposit.id,
      referenceType: "deposit",
    });

    await db.insert(adminLogsTable).values({
      adminId: req.adminUser.id,
      action: "deposit_rejected",
      targetType: "deposit",
      targetId: deposit.id,
      newValue: JSON.stringify({ reason: parsed.data.reason }),
      ipAddress: req.ip,
    });

    req.log.info({ adminId: req.adminUser.id, depositId: deposit.id }, "Deposit rejected");
    res.json({ success: true, message: "Deposit rejected" });
  },
);

export default router;
