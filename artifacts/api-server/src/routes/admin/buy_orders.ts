import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { buyOrdersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

const BuyOrderBody = z.discriminatedUnion("paymentMethod", [
  z.object({
    paymentMethod: z.literal("upi"),
    title: z.string().min(2).max(200),
    amount: z.number().positive(),
    upiId: z.string().min(3).max(100),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional().default(true),
    quantity: z.number().int().min(1).max(500).optional().default(1),
  }),
  z.object({
    paymentMethod: z.literal("bank"),
    title: z.string().min(2).max(200),
    amount: z.number().positive(),
    name: z.string().min(1).max(200),
    accountNumber: z.string().min(5).max(30),
    ifscCode: z.string().min(4).max(20),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional().default(true),
    quantity: z.number().int().min(1).max(500).optional().default(1),
  }),
]);

// GET /api/admin/buy-orders
router.get("/buy-orders", async (_req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(buyOrdersTable)
    .orderBy(desc(buyOrdersTable.createdAt));

  res.json({ orders });
});

// POST /api/admin/buy-orders — quantity>1 creates that many separate order rows (each maxClaims=1)
router.post("/buy-orders", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = BuyOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data = parsed.data;
  const count = data.quantity ?? 1;

  const rows = Array.from({ length: count }, () => {
    if (data.paymentMethod === "upi") {
      return {
        title: data.title,
        amount: data.amount.toFixed(2),
        paymentMethod: "upi" as const,
        upiId: data.upiId,
        name: data.name ?? null,
        accountNumber: null as string | null,
        ifscCode: null as string | null,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        maxClaims: 1,
        createdBy: req.adminUser!.id,
      };
    } else {
      return {
        title: data.title,
        amount: data.amount.toFixed(2),
        paymentMethod: "bank" as const,
        upiId: null as string | null,
        name: data.name,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        maxClaims: 1,
        createdBy: req.adminUser!.id,
      };
    }
  });

  const orders = await db.insert(buyOrdersTable).values(rows).returning();

  res.status(201).json({ success: true, orders, count: orders.length });
});

// PATCH /api/admin/buy-orders/:id
router.patch("/buy-orders/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = z.object({
    title: z.string().min(2).max(200).optional(),
    amount: z.number().positive().optional(),
    paymentMethod: z.enum(["upi", "bank"]).optional(),
    upiId: z.string().min(3).max(100).nullable().optional(),
    name: z.string().min(1).max(200).optional(),
    accountNumber: z.string().min(5).max(30).nullable().optional(),
    ifscCode: z.string().min(4).max(20).nullable().optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
    maxClaims: z.number().int().min(1).max(10000).optional(),
  }).safeParse(req.body);

  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const data = parsed.data;
  if (data.title !== undefined) updates.title = data.title;
  if (data.amount !== undefined) updates.amount = data.amount.toFixed(2);
  if (data.paymentMethod !== undefined) updates.paymentMethod = data.paymentMethod;
  if (data.upiId !== undefined) updates.upiId = data.upiId;
  if (data.name !== undefined) updates.name = data.name;
  if (data.accountNumber !== undefined) updates.accountNumber = data.accountNumber;
  if (data.ifscCode !== undefined) updates.ifscCode = data.ifscCode;
  if (data.description !== undefined) updates.description = data.description;
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.maxClaims !== undefined) updates.maxClaims = data.maxClaims;

  const [order] = await db
    .update(buyOrdersTable)
    .set(updates)
    .where(eq(buyOrdersTable.id, req.params.id as string))
    .returning();

  if (!order) { res.status(404).json({ error: "Buy order not found" }); return; }

  res.json({ success: true, order });
});

// DELETE /api/admin/buy-orders/:id
router.delete("/buy-orders/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  await db
    .delete(buyOrdersTable)
    .where(eq(buyOrdersTable.id, req.params.id as string));

  res.json({ success: true });
});

export default router;
