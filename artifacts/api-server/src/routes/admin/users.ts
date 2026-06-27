import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  profilesTable,
  walletsTable,
  adminLogsTable,
  referralsTable,
  sellUpiAccountsTable,
} from "@workspace/db";
import { eq, desc, lt, and, ilike, or, inArray } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { lockWallet, unlockWallet } from "../../lib/wallet";
import { supabaseAdmin } from "../../lib/supabase";

const router: IRouter = Router();

/**
 * Normalize a mobile search string so country-code variants match the stored 10-digit number.
 * Examples: "+916003164460" → "6003164460", "916003164460" → "6003164460"
 */
function normalizeMobileSearch(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits || raw.trim();
}

// GET /api/admin/users — list all users
router.get("/users", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    search: z.string().optional(),
    status: z.enum(["active", "suspended", "blocked"]).optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit, before, search, status } = parsed.data;

  const conditions: any[] = [];
  if (search) {
    const normalized = normalizeMobileSearch(search);
    conditions.push(
      or(
        ilike(profilesTable.name, `%${search}%`),
        ilike(profilesTable.mobile, `%${normalized}%`),
        ilike(profilesTable.referralCode, `%${search}%`),
      ),
    );
  }
  if (status === "suspended") conditions.push(eq(profilesTable.isSuspended, true));
  if (status === "blocked") conditions.push(eq(profilesTable.isBlocked, true));
  if (status === "active") {
    conditions.push(eq(profilesTable.isActive, true));
    conditions.push(eq(profilesTable.isSuspended, false));
    conditions.push(eq(profilesTable.isBlocked, false));
  }
  if (before) conditions.push(lt(profilesTable.createdAt, new Date(before)));

  const users = await db
    .select({
      id: profilesTable.id,
      name: profilesTable.name,
      mobile: profilesTable.mobile,
      referralCode: profilesTable.referralCode,
      isActive: profilesTable.isActive,
      isSuspended: profilesTable.isSuspended,
      isBlocked: profilesTable.isBlocked,
      sellUpiId: profilesTable.sellUpiId,
      createdAt: profilesTable.createdAt,
      inrBalance: walletsTable.inrBalance,
      usdtBalance: walletsTable.usdtBalance,
      walletFrozen: walletsTable.isFrozen,
    })
    .from(profilesTable)
    .leftJoin(walletsTable, eq(profilesTable.id, walletsTable.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(profilesTable.createdAt))
    .limit(limit + 1);

  const hasMore = users.length > limit;
  const items = hasMore ? users.slice(0, limit) : users;

  // Batch-fetch sell UPI accounts to avoid LEFT JOIN duplicates when users have multiple UPIs
  let sellUpiMap: Record<string, { upiId: string; provider: string }> = {};
  if (items.length > 0) {
    const userIds = items.map((u) => u.id);
    const upiRows = await db
      .select({
        userId: sellUpiAccountsTable.userId,
        upiId: sellUpiAccountsTable.upiId,
        provider: sellUpiAccountsTable.provider,
      })
      .from(sellUpiAccountsTable)
      .where(inArray(sellUpiAccountsTable.userId, userIds));

    for (const row of upiRows) {
      // Keep first found (most recently-added comes first via table insert order)
      if (!sellUpiMap[row.userId]) {
        sellUpiMap[row.userId] = { upiId: row.upiId, provider: row.provider };
      }
    }
  }

  const enriched = items.map((u) => ({
    ...u,
    sellUpiId: sellUpiMap[u.id]?.upiId ?? u.sellUpiId ?? null,
    sellUpiProvider: sellUpiMap[u.id]?.provider ?? null,
  }));

  res.json({
    users: enriched,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
  });
});

// GET /api/admin/users/:id — get a user's full profile
router.get("/users/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, (req.params.id as string)))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.id))
    .limit(1);

  const referralStats = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, user.id));

  const sellUpiAccounts = await db
    .select()
    .from(sellUpiAccountsTable)
    .where(eq(sellUpiAccountsTable.userId, user.id));

  res.json({
    user: {
      ...user,
      wallet,
      sellUpiAccounts,
      referralStats: {
        total: referralStats.length,
        levelA: referralStats.filter((r) => r.level === "A").length,
        levelB: referralStats.filter((r) => r.level === "B").length,
        levelC: referralStats.filter((r) => r.level === "C").length,
        totalEarned: referralStats
          .filter((r) => r.rewardStatus === "paid")
          .reduce((s, r) => s + parseFloat(r.rewardAmount), 0)
          .toFixed(2),
      },
    },
  });
});

// PATCH /api/admin/users/:id/suspend
router.patch("/users/:id/suspend", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({ reason: z.string().min(5).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db
    .select({ id: profilesTable.id, isSuspended: profilesTable.isSuspended })
    .from(profilesTable)
    .where(eq(profilesTable.id, (req.params.id as string)))
    .limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db
    .update(profilesTable)
    .set({ isSuspended: true, updatedAt: new Date() })
    .where(eq(profilesTable.id, user.id));

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "user_suspended",
    targetType: "user",
    targetId: user.id,
    previousValue: JSON.stringify({ isSuspended: user.isSuspended }),
    newValue: JSON.stringify({ isSuspended: true, reason: parsed.data.reason }),
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, userId: user.id }, "User suspended");
  res.json({ success: true, message: "User suspended" });
});

// PATCH /api/admin/users/:id/unsuspend
router.patch("/users/:id/unsuspend", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  await db
    .update(profilesTable)
    .set({ isSuspended: false, updatedAt: new Date() })
    .where(eq(profilesTable.id, (req.params.id as string)));

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "user_unsuspended",
    targetType: "user",
    targetId: (req.params.id as string),
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "User unsuspended" });
});

// PATCH /api/admin/users/:id/block
router.patch("/users/:id/block", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({ reason: z.string().min(5).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db
    .select({ id: profilesTable.id, supabaseUid: profilesTable.supabaseUid })
    .from(profilesTable)
    .where(eq(profilesTable.id, (req.params.id as string)))
    .limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db
    .update(profilesTable)
    .set({ isBlocked: true, updatedAt: new Date() })
    .where(eq(profilesTable.id, user.id));

  await lockWallet(user.id, `Blocked: ${parsed.data.reason}`, req.adminUser.id);

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "user_blocked",
    targetType: "user",
    targetId: user.id,
    newValue: JSON.stringify({ reason: parsed.data.reason }),
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, userId: user.id }, "User blocked");
  res.json({ success: true, message: "User blocked" });
});

// PATCH /api/admin/users/:id/unblock
router.patch("/users/:id/unblock", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  await db
    .update(profilesTable)
    .set({ isBlocked: false, updatedAt: new Date() })
    .where(eq(profilesTable.id, (req.params.id as string)));

  await unlockWallet((req.params.id as string), "Unblocked by admin", req.adminUser.id);

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "user_unblocked",
    targetType: "user",
    targetId: (req.params.id as string),
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "User unblocked" });
});

// PATCH /api/admin/users/:id/wallet/freeze
router.patch(
  "/users/:id/wallet/freeze",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    const schema = z.object({ reason: z.string().min(5).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    await lockWallet((req.params.id as string), parsed.data.reason, req.adminUser.id);

    await db.insert(adminLogsTable).values({
      adminId: req.adminUser.id,
      action: "wallet_frozen",
      targetType: "user",
      targetId: (req.params.id as string),
      newValue: JSON.stringify({ reason: parsed.data.reason }),
      ipAddress: req.ip,
    });

    res.json({ success: true, message: "Wallet frozen" });
  },
);

// PATCH /api/admin/users/:id/wallet/unfreeze
router.patch(
  "/users/:id/wallet/unfreeze",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    await unlockWallet((req.params.id as string), "Unfrozen by admin", req.adminUser.id);

    await db.insert(adminLogsTable).values({
      adminId: req.adminUser.id,
      action: "wallet_unfrozen",
      targetType: "user",
      targetId: (req.params.id as string),
      ipAddress: req.ip,
    });

    res.json({ success: true, message: "Wallet unfrozen" });
  },
);

export default router;
