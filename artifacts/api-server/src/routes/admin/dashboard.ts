import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  profilesTable,
  walletsTable,
  depositsTable,
  withdrawalsTable,
  taskSubmissionsTable,
  supportTicketsTable,
  fraudChecksTable,
  upiAccountsTable,
} from "@workspace/db";
import { eq, and, gte, count, sql, inArray } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/admin/dashboard — aggregated stats
router.get("/dashboard", async (req: AuthenticatedRequest, res): Promise<void> => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers30d,
    pendingDeposits,
    pendingWithdrawals,
    pendingTaskSubmissions,
    openTickets,
    pendingUpiAccounts,
    flaggedFraud,
    totalTokensRow,
    totalDepositsRow,
    totalWithdrawalsRow,
  ] = await Promise.all([
    db.select({ count: count() }).from(profilesTable),
    db
      .select({ count: count() })
      .from(profilesTable)
      .where(gte(profilesTable.createdAt, since30d)),
    db
      .select({ count: count() })
      .from(depositsTable)
      .where(eq(depositsTable.status, "pending")),
    db
      .select({ count: count() })
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.status, "pending")),
    db
      .select({ count: count() })
      .from(taskSubmissionsTable)
      .where(eq(taskSubmissionsTable.status, "pending_review")),
    db
      .select({ count: count() })
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.status, "open")),
    db
      .select({ count: count() })
      .from(upiAccountsTable)
      .where(eq(upiAccountsTable.status, "pending")),
    db
      .select({ count: count() })
      .from(fraudChecksTable)
      .where(
        and(
          eq(fraudChecksTable.isFlagged, true),
          gte(fraudChecksTable.createdAt, since24h),
        ),
      ),
    db
      .select({ total: sql<string>`COALESCE(SUM(${walletsTable.inrBalance}), 0)` })
      .from(walletsTable),
    db
      .select({
        count: count(),
        total: sql<string>`COALESCE(SUM(${depositsTable.amount}), 0)`,
      })
      .from(depositsTable)
      .where(eq(depositsTable.status, "approved")),
    db
      .select({
        count: count(),
        total: sql<string>`COALESCE(SUM(${withdrawalsTable.amount}), 0)`,
      })
      .from(withdrawalsTable)
      .where(inArray(withdrawalsTable.status, ["processed", "approved"])),
  ]);

  const depositStats = await db
    .select({
      status: depositsTable.status,
      count: count(),
      total: sql<string>`COALESCE(SUM(${depositsTable.amount}), 0)`,
    })
    .from(depositsTable)
    .where(gte(depositsTable.createdAt, since30d))
    .groupBy(depositsTable.status);

  const withdrawalStats = await db
    .select({
      status: withdrawalsTable.status,
      count: count(),
      total: sql<string>`COALESCE(SUM(${withdrawalsTable.amount}), 0)`,
    })
    .from(withdrawalsTable)
    .where(gte(withdrawalsTable.createdAt, since30d))
    .groupBy(withdrawalsTable.status);

  res.json({
    overview: {
      totalUsers: totalUsers[0]?.count ?? 0,
      newUsersLast30d: activeUsers30d[0]?.count ?? 0,
      pendingDeposits: pendingDeposits[0]?.count ?? 0,
      pendingWithdrawals: pendingWithdrawals[0]?.count ?? 0,
      pendingTaskSubmissions: pendingTaskSubmissions[0]?.count ?? 0,
      openSupportTickets: openTickets[0]?.count ?? 0,
      pendingUpiAccounts: pendingUpiAccounts[0]?.count ?? 0,
      flaggedFraudLast24h: flaggedFraud[0]?.count ?? 0,
      totalTokens: totalTokensRow[0]?.total ?? "0",
      totalDepositsCount: totalDepositsRow[0]?.count ?? 0,
      totalDepositsAmount: totalDepositsRow[0]?.total ?? "0",
      totalWithdrawalsCount: totalWithdrawalsRow[0]?.count ?? 0,
      totalWithdrawalsAmount: totalWithdrawalsRow[0]?.total ?? "0",
    },
    financials: {
      deposits: depositStats,
      withdrawals: withdrawalStats,
    },
  });
});

export default router;
