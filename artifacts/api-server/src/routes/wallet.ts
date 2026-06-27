import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  walletsTable,
  walletLedgerTable,
  transactionsTable,
  depositsTable,
} from "@workspace/db";
import { eq, and, desc, lt, gte, inArray, count, sum } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

async function getWalletBalance(req: AuthenticatedRequest, res: any): Promise<void> {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, req.user.id))
    .limit(1);

  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  res.json({
    inrBalance: wallet.inrBalance,
    usdtBalance: wallet.usdtBalance,
    isFrozen: wallet.isFrozen,
    updatedAt: wallet.updatedAt,
  });
}

router.get("/wallet", requireAuth as any, getWalletBalance);
router.get("/wallet/balance", requireAuth as any, getWalletBalance);

router.get(
  "/wallet/ledger",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      before: z.string().optional(),
      currency: z.enum(["INR", "USDT"]).optional(),
      type: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit, before, currency, type } = parsed.data;

    const conditions = [eq(walletLedgerTable.userId, req.user.id)];
    if (currency) conditions.push(eq(walletLedgerTable.currency, currency));
    if (type) conditions.push(eq(walletLedgerTable.type, type));
    if (before) conditions.push(lt(walletLedgerTable.createdAt, new Date(before)));

    const entries = await db
      .select()
      .from(walletLedgerTable)
      .where(and(...conditions))
      .orderBy(desc(walletLedgerTable.createdAt))
      .limit(limit + 1);

    const hasMore = entries.length > limit;
    const items = hasMore ? entries.slice(0, limit) : entries;

    res.json({
      entries: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

router.get(
  "/wallet/transactions",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      before: z.string().optional(),
      type: z.string().optional(),
      status: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit, before, type, status } = parsed.data;

    const conditions = [eq(transactionsTable.userId, req.user.id)];
    if (type) conditions.push(eq(transactionsTable.type, type));
    if (status) conditions.push(eq(transactionsTable.status, status));
    if (before) conditions.push(lt(transactionsTable.createdAt, new Date(before)));

    const txns = await db
      .select()
      .from(transactionsTable)
      .where(and(...conditions))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit + 1);

    const hasMore = txns.length > limit;
    const items = hasMore ? txns.slice(0, limit) : txns;

    res.json({
      transactions: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

// GET /api/token-history — unified token history for the Token page
router.get(
  "/token-history",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const LIMIT = 60;

    // 1. Ledger entries: approved buy credits, referral rewards, team commission, credits, debits
    const ledgerEntries = await db
      .select()
      .from(walletLedgerTable)
      .where(and(
        eq(walletLedgerTable.userId, req.user.id),
        eq(walletLedgerTable.currency, "INR"),
      ))
      .orderBy(desc(walletLedgerTable.createdAt))
      .limit(LIMIT);

    // 2. Deposits that are NOT approved (pending/rejected/cancelled/paying) — buy orders only
    const pendingDeposits = await db
      .select({
        id: depositsTable.id,
        amount: depositsTable.amount,
        status: depositsTable.status,
        adminNotes: depositsTable.adminNotes,
        rejectedReason: depositsTable.rejectedReason,
        cancelReason: depositsTable.cancelReason,
        createdAt: depositsTable.createdAt,
        updatedAt: depositsTable.updatedAt,
      })
      .from(depositsTable)
      .where(and(
        eq(depositsTable.userId, req.user.id),
        inArray(depositsTable.status, ["paying", "pending", "pending_verification", "rejected", "cancelled"]),
      ))
      .orderBy(desc(depositsTable.createdAt))
      .limit(LIMIT);

    // 3. Sell / Withdrawal transactions
    const txns = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, req.user.id))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(LIMIT);

    // Map ledger entries to display items
    const ledgerItems = ledgerEntries.map((e) => {
      const isCredit = parseFloat(e.amount) >= 0;
      const typeMap: Record<string, string> = {
        deposit: "Buy Approved",
        buy_order: "Buy Approved",
        deposit_credit: "Buy Approved",
        task_reward: "Task Reward",
        referral_reward: "Referral Reward",
        referral_bonus: "Referral Bonus",
        team_commission: "Team Commission",
        credit: "Wallet Credit",
        debit: "Wallet Debit",
        withdrawal_refund: "Withdrawal Refund",
      };
      const label = typeMap[e.type ?? ""] ?? (e.type ?? "").replace(/_/g, " ");
      return {
        id: `led_${e.id}`,
        source: "ledger" as const,
        displayType: e.type ?? "credit",
        label,
        amount: Math.abs(parseFloat(e.amount)).toFixed(2),
        currency: "INR" as const,
        isCredit,
        status: isCredit ? "credited" : "debited",
        date: e.createdAt.toISOString(),
        note: e.description ?? null,
      };
    });

    // Map pending deposits to display items
    const depositItems = pendingDeposits.map((d) => {
      const statusMap: Record<string, string> = {
        paying: "Buy - Paying",
        pending: "Buy Pending",
        pending_verification: "Buy Pending",
        rejected: "Buy Rejected",
        cancelled: "Buy Cancelled",
      };
      const note = d.adminNotes ?? d.rejectedReason ?? d.cancelReason ?? null;
      return {
        id: `dep_${d.id}`,
        source: "deposit" as const,
        displayType: d.status,
        label: statusMap[d.status] ?? "Buy Order",
        amount: parseFloat(d.amount).toFixed(2),
        currency: "INR" as const,
        isCredit: false,
        status: d.status,
        date: d.createdAt.toISOString(),
        note,
      };
    });

    // Map transactions to display items
    const txnItems = txns.map((t) => {
      const isPaid = t.status === "completed" || t.status === "paid";
      return {
        id: `txn_${t.id}`,
        source: "transaction" as const,
        displayType: t.type ?? "withdrawal",
        label: isPaid ? "Sell Paid" : "Sell Pending",
        amount: parseFloat(t.amount ?? "0").toFixed(2),
        currency: "INR" as const,
        isCredit: false,
        status: t.status ?? "pending",
        date: t.createdAt.toISOString(),
        note: t.description ?? null,
      };
    });

    // Merge and sort all items by date descending
    const allItems = [...ledgerItems, ...depositItems, ...txnItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.json({ items: allItems.slice(0, LIMIT) });
  },
);

// GET /api/monthly-stats — token/monthly stats for the current user
router.get(
  "/monthly-stats",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [wallet] = await db
      .select({ inrBalance: walletsTable.inrBalance })
      .from(walletsTable)
      .where(eq(walletsTable.userId, req.user.id))
      .limit(1);

    const [monthReceived] = await db
      .select({ total: count() })
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.userId, req.user.id),
          eq(depositsTable.status, "approved"),
          gte(depositsTable.updatedAt, startOfMonth),
        ),
      );

    const [monthProfit] = await db
      .select({ total: sum(walletLedgerTable.amount) })
      .from(walletLedgerTable)
      .where(
        and(
          eq(walletLedgerTable.userId, req.user.id),
          inArray(walletLedgerTable.type, ["task_reward", "referral_reward", "team_commission", "referral_bonus"]),
          gte(walletLedgerTable.createdAt, startOfMonth),
          eq(walletLedgerTable.currency, "INR"),
        ),
      );

    res.json({
      tokenAvailable: wallet?.inrBalance ?? "0",
      monthReceived: Number(monthReceived?.total ?? 0),
      monthProfit: monthProfit?.total ?? "0",
    });
  },
);

// GET /api/today-stats — today & month received/profit for dashboard + team page
router.get(
  "/today-stats",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRow] = await db
      .select({ total: sum(depositsTable.amount) })
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.userId, req.user.id),
          eq(depositsTable.status, "approved"),
          gte(depositsTable.approvedAt, startOfToday),
        ),
      );

    const [monthRow] = await db
      .select({ total: sum(depositsTable.amount) })
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.userId, req.user.id),
          eq(depositsTable.status, "approved"),
          gte(depositsTable.approvedAt, startOfMonth),
        ),
      );

    const [monthTeamRow] = await db
      .select({ total: sum(walletLedgerTable.amount) })
      .from(walletLedgerTable)
      .where(
        and(
          eq(walletLedgerTable.userId, req.user.id),
          eq(walletLedgerTable.type, "team_commission"),
          gte(walletLedgerTable.createdAt, startOfMonth),
          eq(walletLedgerTable.currency, "INR"),
        ),
      );

    const todayReceived = parseFloat(todayRow?.total ?? "0");
    const todayProfit = todayReceived * 0.05;
    const monthReceived = parseFloat(monthRow?.total ?? "0");
    const monthProfit = monthReceived * 0.05;
    const monthTeamCommission = parseFloat(monthTeamRow?.total ?? "0");

    res.json({
      todayReceived: todayReceived.toFixed(2),
      todayProfit: todayProfit.toFixed(2),
      monthReceived: monthReceived.toFixed(2),
      monthProfit: monthProfit.toFixed(2),
      monthTeamCommission: monthTeamCommission.toFixed(2),
    });
  },
);

export default router;
