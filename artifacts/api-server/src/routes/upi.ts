import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { upiAccountsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const ALL_PROVIDERS = ["paytm", "mobikwik", "freecharge"] as const;
type Provider = typeof ALL_PROVIDERS[number];

const AddUpiBody = z.object({
  upiId: z.string().min(5).max(100),
  accountHolderName: z.string().min(2).max(100).trim(),
  provider: z.enum(ALL_PROVIDERS),
});

// GET /api/upi — list my UPI accounts
router.get(
  "/upi",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const accounts = await db
      .select()
      .from(upiAccountsTable)
      .where(
        and(
          eq(upiAccountsTable.userId, req.user.id),
          isNull(upiAccountsTable.deletedAt),
        ),
      )
      .orderBy(upiAccountsTable.createdAt);

    res.json({ accounts });
  },
);

// POST /api/upi — add a UPI account after OTP verification
router.post(
  "/upi",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = AddUpiBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { upiId, accountHolderName, provider } = parsed.data;

    const existing = await db
      .select({ id: upiAccountsTable.id })
      .from(upiAccountsTable)
      .where(
        and(
          eq(upiAccountsTable.userId, req.user.id),
          isNull(upiAccountsTable.deletedAt),
        ),
      );

    if (existing.length >= 3) {
      res.status(400).json({ error: "Maximum 3 UPI accounts allowed" });
      return;
    }

    const [account] = await db
      .insert(upiAccountsTable)
      .values({
        userId: req.user.id,
        upiId,
        accountHolderName,
        provider,
        status: "approved",
        isDefault: false,
      })
      .returning();

    req.log.info({ userId: req.user.id, upiId }, "Buy UPI account added");

    res.status(201).json({
      success: true,
      account: {
        id: account.id,
        upiId: account.upiId,
        accountHolderName: account.accountHolderName,
        provider: account.provider,
        status: account.status,
        isDefault: account.isDefault,
        createdAt: account.createdAt,
      },
    });
  },
);

// DELETE /api/upi/:id — soft-delete a UPI account
router.delete(
  "/upi/:id",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [account] = await db
      .select()
      .from(upiAccountsTable)
      .where(
        and(
          eq(upiAccountsTable.id, req.params.id as string),
          eq(upiAccountsTable.userId, req.user.id),
          isNull(upiAccountsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!account) {
      res.status(404).json({ error: "UPI account not found" });
      return;
    }

    await db
      .update(upiAccountsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(upiAccountsTable.id, account.id));

    req.log.info({ userId: req.user.id, upiId: account.upiId }, "Buy UPI account deleted");
    res.json({ success: true });
  },
);

export default router;
