import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sellUpiAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const ALL_SELL_PROVIDERS = ["paytm", "mobikwik", "phonepe", "airtel", "navi"] as const;

const UpsertSellUpiBody = z.object({
  upiId: z.string().min(5).max(100),
  accountHolderName: z.string().min(1).max(200),
  provider: z.enum(ALL_SELL_PROVIDERS),
});

// GET /api/sell-upi — get all sell UPI accounts for the current user
router.get(
  "/sell-upi",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const accounts = await db
      .select()
      .from(sellUpiAccountsTable)
      .where(eq(sellUpiAccountsTable.userId, req.user.id))
      .orderBy(sellUpiAccountsTable.createdAt);

    res.json({ accounts });
  },
);

// POST /api/sell-upi — add a new sell UPI account
router.post(
  "/sell-upi",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = UpsertSellUpiBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

    const { upiId, accountHolderName, provider } = parsed.data;

    const [account] = await db
      .insert(sellUpiAccountsTable)
      .values({ userId: req.user.id, upiId, accountHolderName, provider })
      .returning();

    res.status(201).json({ success: true, account });
  },
);

// PUT /api/sell-upi/:id — update an existing sell UPI account
router.put(
  "/sell-upi/:id",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = UpsertSellUpiBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

    const { upiId, accountHolderName, provider } = parsed.data;

    const [existing] = await db
      .select({ id: sellUpiAccountsTable.id })
      .from(sellUpiAccountsTable)
      .where(
        and(
          eq(sellUpiAccountsTable.id, req.params.id as string),
          eq(sellUpiAccountsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Sell UPI account not found" });
      return;
    }

    const [account] = await db
      .update(sellUpiAccountsTable)
      .set({ upiId, accountHolderName, provider, updatedAt: new Date() })
      .where(eq(sellUpiAccountsTable.id, existing.id))
      .returning();

    res.json({ success: true, account });
  },
);

// DELETE /api/sell-upi/:id — remove a sell UPI account
router.delete(
  "/sell-upi/:id",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [existing] = await db
      .select({ id: sellUpiAccountsTable.id })
      .from(sellUpiAccountsTable)
      .where(
        and(
          eq(sellUpiAccountsTable.id, req.params.id as string),
          eq(sellUpiAccountsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Sell UPI account not found" });
      return;
    }

    await db
      .delete(sellUpiAccountsTable)
      .where(eq(sellUpiAccountsTable.id, existing.id));

    res.json({ success: true });
  },
);

export default router;
