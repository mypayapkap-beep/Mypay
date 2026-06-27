import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  sellRequestsTable,
  profilesTable,
  walletsTable,
  adminLogsTable,
  notificationsTable,
  transactionsTable,
  sellUpiAccountsTable,
} from "@workspace/db";
import { eq, and, desc, lt, ilike } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { debitWallet } from "../../lib/wallet";

const router: IRouter = Router();

// POST /api/admin/sell-requests — create a sell request for a user
router.post("/sell-requests", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({
    mobile: z.string().min(5).max(20),
    tokenAmount: z.coerce.number().positive().multipleOf(0.01),
    adminNotes: z.string().max(500).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }); return; }

  const { mobile, tokenAmount, adminNotes } = parsed.data;

  // Find user by mobile
  const [profile] = await db
    .select({
      id: profilesTable.id,
      name: profilesTable.name,
      mobile: profilesTable.mobile,
    })
    .from(profilesTable)
    .where(ilike(profilesTable.mobile, `%${mobile.replace(/\D/g, "")}%`))
    .limit(1);

  if (!profile) { res.status(404).json({ error: "User not found with that mobile number" }); return; }

  // Check wallet balance
  const [wallet] = await db
    .select({ inrBalance: walletsTable.inrBalance })
    .from(walletsTable)
    .where(eq(walletsTable.userId, profile.id))
    .limit(1);

  const balance = parseFloat(wallet?.inrBalance ?? "0");
  if (tokenAmount > balance) {
    res.status(400).json({
      error: `Insufficient balance. User has ₹${balance.toFixed(2)}, requested ₹${tokenAmount.toFixed(2)}`,
    });
    return;
  }

  const tokenAmountStr = tokenAmount.toFixed(2);

  const [created] = await db
    .insert(sellRequestsTable)
    .values({
      userId: profile.id,
      tokenAmount: tokenAmountStr,
      sellAmount: tokenAmountStr,
      status: "pending",
      createdBy: req.adminUser.id,
      adminNotes: adminNotes ?? null,
    })
    .returning({ id: sellRequestsTable.id });

  await db.insert(notificationsTable).values({
    userId: profile.id,
    category: "withdrawal",
    title: "Sell Request Created",
    message: `A sell request for ₹${tokenAmountStr} has been created for your account. Awaiting payment.`,
    referenceId: created!.id,
    referenceType: "sell_request",
  });

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "sell_request_created",
    targetType: "sell_request",
    targetId: created!.id,
    newValue: JSON.stringify({ userId: profile.id, tokenAmount: tokenAmountStr }),
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, sellRequestId: created!.id }, "Sell request created");
  res.json({ success: true, message: "Sell request created successfully" });
});

// GET /api/admin/sell-requests — list all sell requests
router.get("/sell-requests", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    status: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, before, status } = parsed.data;

  const conditions: any[] = [];
  if (status) conditions.push(eq(sellRequestsTable.status, status));
  if (before) conditions.push(lt(sellRequestsTable.createdAt, new Date(before)));

  const items = await db
    .select({
      id: sellRequestsTable.id,
      tokenAmount: sellRequestsTable.tokenAmount,
      sellAmount: sellRequestsTable.sellAmount,
      status: sellRequestsTable.status,
      adminNotes: sellRequestsTable.adminNotes,
      approvedAt: sellRequestsTable.approvedAt,
      rejectedAt: sellRequestsTable.rejectedAt,
      createdAt: sellRequestsTable.createdAt,
      userId: sellRequestsTable.userId,
      userName: profilesTable.name,
      userMobile: profilesTable.mobile,
      userSellUpi: sellUpiAccountsTable.upiId,
      userSellUpiProvider: sellUpiAccountsTable.provider,
    })
    .from(sellRequestsTable)
    .leftJoin(profilesTable, eq(sellRequestsTable.userId, profilesTable.id))
    .leftJoin(
      sellUpiAccountsTable,
      eq(sellUpiAccountsTable.userId, sellRequestsTable.userId),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sellRequestsTable.createdAt))
    .limit(limit + 1);

  const hasMore = items.length > limit;
  const result = hasMore ? items.slice(0, limit) : items;

  res.json({ sellRequests: result, hasMore });
});

// PATCH /api/admin/sell-requests/:id/approve — approve & deduct tokens
router.patch("/sell-requests/:id/approve", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({ adminNotes: z.string().max(500).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [sellRequest] = await db
    .select()
    .from(sellRequestsTable)
    .where(eq(sellRequestsTable.id, req.params.id as string))
    .limit(1);

  if (!sellRequest) { res.status(404).json({ error: "Sell request not found" }); return; }
  if (sellRequest.status !== "pending") {
    res.status(400).json({ error: `Sell request is already ${sellRequest.status}` });
    return;
  }

  // Deduct tokens from wallet (prevents negative balance automatically)
  try {
    await debitWallet({
      userId: sellRequest.userId,
      amount: sellRequest.tokenAmount,
      currency: "INR",
      type: "sell_approved",
      referenceId: sellRequest.id,
      description: `Sell request approved — ₹${sellRequest.tokenAmount} deducted`,
      idempotencyKey: `sell_approved_${sellRequest.id}`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Failed to deduct balance" });
    return;
  }

  await db
    .update(sellRequestsTable)
    .set({
      status: "approved",
      approvedBy: req.adminUser.id,
      approvedAt: new Date(),
      adminNotes: parsed.data.adminNotes ?? sellRequest.adminNotes,
      updatedAt: new Date(),
    })
    .where(eq(sellRequestsTable.id, sellRequest.id));

  await db.insert(notificationsTable).values({
    userId: sellRequest.userId,
    category: "withdrawal",
    title: "Sell Request Approved",
    message: `Your sell request for ₹${sellRequest.sellAmount} has been approved and payment sent to your UPI.`,
    referenceId: sellRequest.id,
    referenceType: "sell_request",
  });

  // Record in transaction history
  await db.insert(transactionsTable).values({
    userId: sellRequest.userId,
    type: "sell_approved",
    currency: "INR",
    amount: `-${sellRequest.tokenAmount}`,
    status: "completed",
    referenceId: sellRequest.id,
    referenceType: "sell_request",
    description: `Sell request approved — ₹${sellRequest.tokenAmount} paid to UPI`,
  });

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "sell_request_approved",
    targetType: "sell_request",
    targetId: sellRequest.id,
    newValue: JSON.stringify({ tokenAmount: sellRequest.tokenAmount, approvedBy: req.adminUser.id }),
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, sellRequestId: sellRequest.id }, "Sell request approved");
  res.json({ success: true, message: "Sell request approved and tokens deducted" });
});

// PATCH /api/admin/sell-requests/:id/reject — reject without deducting
router.patch("/sell-requests/:id/reject", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({ reason: z.string().min(3).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [sellRequest] = await db
    .select()
    .from(sellRequestsTable)
    .where(eq(sellRequestsTable.id, req.params.id as string))
    .limit(1);

  if (!sellRequest) { res.status(404).json({ error: "Sell request not found" }); return; }
  if (sellRequest.status !== "pending") {
    res.status(400).json({ error: `Sell request is already ${sellRequest.status}` });
    return;
  }

  await db
    .update(sellRequestsTable)
    .set({
      status: "rejected",
      rejectedBy: req.adminUser.id,
      rejectedAt: new Date(),
      adminNotes: parsed.data.reason,
      updatedAt: new Date(),
    })
    .where(eq(sellRequestsTable.id, sellRequest.id));

  await db.insert(notificationsTable).values({
    userId: sellRequest.userId,
    category: "withdrawal",
    title: "Sell Request Rejected",
    message: `Your sell request for ₹${sellRequest.sellAmount} was rejected. Reason: ${parsed.data.reason}`,
    referenceId: sellRequest.id,
    referenceType: "sell_request",
  });

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "sell_request_rejected",
    targetType: "sell_request",
    targetId: sellRequest.id,
    newValue: JSON.stringify({ reason: parsed.data.reason }),
    ipAddress: req.ip,
  });

  req.log.info({ adminId: req.adminUser.id, sellRequestId: sellRequest.id }, "Sell request rejected");
  res.json({ success: true, message: "Sell request rejected" });
});

export default router;
