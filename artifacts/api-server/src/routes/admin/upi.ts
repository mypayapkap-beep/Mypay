import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { upiAccountsTable, profilesTable, adminLogsTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, lt, isNull } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/admin/upi — list pending UPI accounts
router.get("/upi", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    status: z.string().default("pending"),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, before, status } = parsed.data;

  const conditions: any[] = [isNull(upiAccountsTable.deletedAt)];
  if (status) conditions.push(eq(upiAccountsTable.status, status));
  if (before) conditions.push(lt(upiAccountsTable.createdAt, new Date(before)));

  const accounts = await db
    .select({
      id: upiAccountsTable.id,
      upiId: upiAccountsTable.upiId,
      accountHolderName: upiAccountsTable.accountHolderName,
      provider: upiAccountsTable.provider,
      status: upiAccountsTable.status,
      adminNotes: upiAccountsTable.adminNotes,
      createdAt: upiAccountsTable.createdAt,
      userId: upiAccountsTable.userId,
      userName: profilesTable.name,
      userMobile: profilesTable.mobile,
    })
    .from(upiAccountsTable)
    .leftJoin(profilesTable, eq(upiAccountsTable.userId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(desc(upiAccountsTable.createdAt))
    .limit(limit + 1);

  const hasMore = accounts.length > limit;
  const items = hasMore ? accounts.slice(0, limit) : accounts;

  res.json({ accounts: items, hasMore });
});

// PATCH /api/admin/upi/:id/approve
router.patch("/upi/:id/approve", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({ adminNotes: z.string().max(200).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [account] = await db
    .select()
    .from(upiAccountsTable)
    .where(eq(upiAccountsTable.id, (req.params.id as string)))
    .limit(1);

  if (!account) { res.status(404).json({ error: "UPI account not found" }); return; }
  if (account.status !== "pending") {
    res.status(400).json({ error: `UPI account is already ${account.status}` });
    return;
  }

  await db
    .update(upiAccountsTable)
    .set({
      status: "approved",
      adminNotes: parsed.data.adminNotes,
      approvedBy: req.adminUser.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(upiAccountsTable.id, account.id));

  await db.insert(notificationsTable).values({
    userId: account.userId,
    category: "upi",
    title: "UPI Account Approved",
    message: `Your UPI account ${account.upiId} has been verified and approved.`,
    referenceId: account.id,
    referenceType: "upi_account",
  });

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "upi_approved",
    targetType: "upi_account",
    targetId: account.id,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "UPI account approved" });
});

// PATCH /api/admin/upi/:id/reject
router.patch("/upi/:id/reject", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({ reason: z.string().min(5).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [account] = await db
    .select()
    .from(upiAccountsTable)
    .where(eq(upiAccountsTable.id, (req.params.id as string)))
    .limit(1);

  if (!account) { res.status(404).json({ error: "UPI account not found" }); return; }

  await db
    .update(upiAccountsTable)
    .set({
      status: "rejected",
      adminNotes: parsed.data.reason,
      updatedAt: new Date(),
    })
    .where(eq(upiAccountsTable.id, account.id));

  await db.insert(notificationsTable).values({
    userId: account.userId,
    category: "upi",
    title: "UPI Account Rejected",
    message: `Your UPI account ${account.upiId} was rejected. Reason: ${parsed.data.reason}`,
    referenceId: account.id,
    referenceType: "upi_account",
  });

  res.json({ success: true, message: "UPI account rejected" });
});

export default router;
