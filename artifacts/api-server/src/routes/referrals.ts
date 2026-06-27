import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { referralsTable, profilesTable, walletLedgerTable } from "@workspace/db";
import { eq, and, desc, sum, gte, inArray } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { creditWallet } from "../lib/wallet";

const router: IRouter = Router();

const DIRECT_REWARD_AMOUNT = "200.00";

// GET /api/referrals/tree and /api/referrals — get my referral tree
router.get(
  ["/referrals/tree", "/referrals"],
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      level: z.enum(["A", "B", "C"]).optional(),
      status: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { level, status } = parsed.data;

    const conditions = [eq(referralsTable.referrerId, req.user.id)];
    if (level) conditions.push(eq(referralsTable.level, level));
    if (status) conditions.push(eq(referralsTable.rewardStatus, status));

    const referrals = await db
      .select({
        id: referralsTable.id,
        level: referralsTable.level,
        rewardAmount: referralsTable.rewardAmount,
        rewardStatus: referralsTable.rewardStatus,
        rewardPaidAt: referralsTable.rewardPaidAt,
        createdAt: referralsTable.createdAt,
        referredId: referralsTable.referredId,
        referredName: profilesTable.name,
        referredMobile: profilesTable.mobile,
        referredJoinedAt: profilesTable.createdAt,
        referredIsActive: profilesTable.isActive,
      })
      .from(referralsTable)
      .leftJoin(profilesTable, eq(referralsTable.referredId, profilesTable.id))
      .where(and(...conditions))
      .orderBy(desc(referralsTable.createdAt));

    const masked = referrals.map((r) => ({
      ...r,
      referredMobile: r.referredMobile
        ? `+91 XXXXXX${r.referredMobile.slice(-4)}`
        : null,
    }));

    // Find Level B members (referred by my direct referrals)
    const directIds = referrals.map((r) => r.referredId);
    let levelBReferrals: typeof masked = [];
    if (directIds.length > 0) {
      const lbRows = await db
        .select({
          id: referralsTable.id,
          level: referralsTable.level,
          rewardAmount: referralsTable.rewardAmount,
          rewardStatus: referralsTable.rewardStatus,
          rewardPaidAt: referralsTable.rewardPaidAt,
          createdAt: referralsTable.createdAt,
          referredId: referralsTable.referredId,
          referredName: profilesTable.name,
          referredMobile: profilesTable.mobile,
          referredJoinedAt: profilesTable.createdAt,
          referredIsActive: profilesTable.isActive,
        })
        .from(referralsTable)
        .leftJoin(profilesTable, eq(referralsTable.referredId, profilesTable.id))
        .where(inArray(referralsTable.referrerId, directIds))
        .orderBy(desc(referralsTable.createdAt));

      levelBReferrals = lbRows.map((r) => ({
        ...r,
        level: "B" as string,
        referredMobile: r.referredMobile
          ? `+91 XXXXXX${r.referredMobile.slice(-4)}`
          : null,
      }));
    }

    const byLevel = {
      A: masked,
      B: levelBReferrals,
    };

    const totalEarned = referrals
      .filter((r) => r.rewardStatus === "claimed")
      .reduce((s, r) => s + parseFloat(r.rewardAmount), 0);

    const pendingEarnings = referrals
      .filter((r) => r.rewardStatus === "pending")
      .reduce((s, r) => s + parseFloat(r.rewardAmount), 0);

    res.json({
      referralCode: req.user.referralCode,
      totalReferrals: referrals.length,
      levelBCount: levelBReferrals.length,
      totalEarned: totalEarned.toFixed(2),
      pendingRewards: pendingEarnings.toFixed(2),
      byLevel: level ? { [level]: byLevel[level as keyof typeof byLevel] } : byLevel,
    });
  },
);

// GET /api/referrals/stats — summary stats including team commission
router.get(
  "/referrals/stats",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const directReferrals = await db
      .select({
        id: referralsTable.id,
        level: referralsTable.level,
        rewardStatus: referralsTable.rewardStatus,
        rewardAmount: referralsTable.rewardAmount,
        referredId: referralsTable.referredId,
      })
      .from(referralsTable)
      .where(eq(referralsTable.referrerId, req.user.id));

    const directIds = directReferrals.map((r) => r.referredId);

    // Level B count (referred by my Level A members)
    let levelBCount = 0;
    if (directIds.length > 0) {
      const lbRows = await db
        .select({ id: referralsTable.id })
        .from(referralsTable)
        .where(inArray(referralsTable.referrerId, directIds));
      levelBCount = lbRows.length;
    }

    // Team commission totals from ledger
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCommRow] = await db
      .select({ total: sum(walletLedgerTable.amount) })
      .from(walletLedgerTable)
      .where(and(
        eq(walletLedgerTable.userId, req.user.id),
        eq(walletLedgerTable.type, "team_commission"),
      ));

    const [monthCommRow] = await db
      .select({ total: sum(walletLedgerTable.amount) })
      .from(walletLedgerTable)
      .where(and(
        eq(walletLedgerTable.userId, req.user.id),
        eq(walletLedgerTable.type, "team_commission"),
        gte(walletLedgerTable.createdAt, monthStart),
      ));

    const [todayCommRow] = await db
      .select({ total: sum(walletLedgerTable.amount) })
      .from(walletLedgerTable)
      .where(and(
        eq(walletLedgerTable.userId, req.user.id),
        eq(walletLedgerTable.type, "team_commission"),
        gte(walletLedgerTable.createdAt, todayStart),
      ));

    const eligibleCount = directReferrals.filter((r) => r.rewardStatus === "eligible").length;
    const claimedTotal = directReferrals
      .filter((r) => r.rewardStatus === "claimed")
      .reduce((s) => s + 200, 0);

    const stats = {
      totalReferrals: directReferrals.length,
      levelA: directReferrals.length,
      levelB: levelBCount,
      totalEarned: claimedTotal.toFixed(2),
      pendingRewards: directReferrals
        .filter((r) => r.rewardStatus === "pending")
        .reduce((s, r) => s + parseFloat(r.rewardAmount), 0)
        .toFixed(2),
      eligibleCount,
      eligibleReward: (eligibleCount * 200).toFixed(2),
      todayCommission: Math.abs(parseFloat(todayCommRow?.total ?? "0")).toFixed(2),
      monthCommission: Math.abs(parseFloat(monthCommRow?.total ?? "0")).toFixed(2),
      totalCommission: Math.abs(parseFloat(totalCommRow?.total ?? "0")).toFixed(2),
    };

    res.json({ referralCode: req.user.referralCode, ...stats });
  },
);

// POST /api/referrals/claim — claim all eligible direct referral rewards
router.post(
  "/referrals/claim",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const eligibleReferrals = await db
      .select()
      .from(referralsTable)
      .where(and(
        eq(referralsTable.referrerId, req.user.id),
        eq(referralsTable.rewardStatus, "eligible"),
      ));

    if (eligibleReferrals.length === 0) {
      res.status(400).json({ error: "No eligible rewards to claim. Referred users must reach ₹5000 buy volume first." });
      return;
    }

    let claimedCount = 0;
    for (const ref of eligibleReferrals) {
      try {
        await creditWallet({
          userId: req.user.id,
          amount: DIRECT_REWARD_AMOUNT,
          currency: "INR",
          type: "referral_reward",
          referenceId: ref.id,
          description: "Direct referral reward — ₹200",
          idempotencyKey: `referral_claim_${ref.id}`,
        });

        await db.update(referralsTable)
          .set({ rewardStatus: "claimed", rewardPaidAt: new Date() })
          .where(eq(referralsTable.id, ref.id));

        claimedCount++;
      } catch (err: any) {
        if (
          err?.code === "23505" ||
          err?.message?.includes("idempotency") ||
          err?.message?.includes("unique")
        ) {
          await db.update(referralsTable)
            .set({ rewardStatus: "claimed" })
            .where(eq(referralsTable.id, ref.id));
        } else {
          throw err;
        }
      }
    }

    res.json({
      success: true,
      claimed: claimedCount,
      totalReward: `${claimedCount * 200}.00`,
      message: `Successfully claimed ₹${claimedCount * 200} direct referral reward${claimedCount > 1 ? "s" : ""}`,
    });
  },
);

export default router;
