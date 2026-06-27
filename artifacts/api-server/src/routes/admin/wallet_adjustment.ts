import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { profilesTable, walletsTable, adminLogsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { creditWallet, generateIdempotencyKey } from "../../lib/wallet";

const router: IRouter = Router();

const AdjustBody = z.object({
  type: z.enum(["credit", "debit"]),
  amount: z.number().positive().max(1000000),
  reason: z.string().min(3).max(500),
});

// POST /api/admin/users/:id/wallet-adjust
router.post("/users/:id/wallet-adjust", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = AdjustBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { type, amount, reason } = parsed.data;
  const userId = req.params.id as string;

  const [profile] = await db
    .select({ id: profilesTable.id, name: profilesTable.name })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (!profile) { res.status(404).json({ error: "User not found" }); return; }

  const [wallet] = await db
    .select({ inrBalance: walletsTable.inrBalance })
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);

  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }

  if (type === "debit") {
    const bal = parseFloat(wallet.inrBalance);
    if (bal < amount) {
      res.status(400).json({ error: `Insufficient balance. User has ₹${bal.toFixed(2)}` });
      return;
    }
  }

  if (type === "credit") {
    await creditWallet({
      userId,
      amount: amount.toFixed(2),
      currency: "INR",
      type: "admin_credit",
      description: `Admin credit: ${reason}`,
      idempotencyKey: generateIdempotencyKey(),
    });
  } else {
    // Debit
    const currentBal = parseFloat(wallet.inrBalance);
    const newBal = (currentBal - amount).toFixed(2);
    await db
      .update(walletsTable)
      .set({ inrBalance: newBal, updatedAt: new Date() })
      .where(eq(walletsTable.userId, userId));
  }

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: `wallet_${type}`,
    targetType: "user",
    targetId: userId,
    newValue: JSON.stringify({ type, amount, reason }),
    ipAddress: req.ip,
  });

  await db.insert(notificationsTable).values({
    userId,
    category: "wallet",
    title: type === "credit" ? "Wallet Credited" : "Wallet Debited",
    message: `Admin ${type === "credit" ? "credited" : "debited"} ₹${amount} ${type === "credit" ? "to" : "from"} your wallet. Reason: ${reason}`,
  });

  res.json({ success: true, message: `Wallet ${type}ed ₹${amount} successfully` });
});

export default router;
