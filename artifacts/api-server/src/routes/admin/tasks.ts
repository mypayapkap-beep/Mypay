import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  tasksTable,
  taskSubmissionsTable,
  profilesTable,
  adminLogsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, desc, lt, isNull } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { creditWallet } from "../../lib/wallet";

const router: IRouter = Router();

const CreateTaskBody = z.object({
  name: z.string().min(3).max(200).trim(),
  description: z.string().min(10).max(2000).trim(),
  amount: z.number().min(1).max(100000),
  durationDays: z.number().int().min(1).max(365).default(1),
  maxSubmissions: z.number().int().min(1).optional(),
  imageUrl: z.string().url().optional(),
});

// POST /api/admin/tasks — create a task
router.post("/tasks", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [task] = await db
    .insert(tasksTable)
    .values({
      ...parsed.data,
      amount: parsed.data.amount.toFixed(2),
      status: "available",
      isActive: true,
    })
    .returning();

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "task_created",
    targetType: "task",
    targetId: task.id,
    newValue: JSON.stringify({ name: task.name, amount: task.amount }),
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, task });
});

// GET /api/admin/tasks — list all tasks
router.get("/tasks", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, before, isActive } = parsed.data;

  const conditions: any[] = [isNull(tasksTable.deletedAt)];
  if (typeof isActive === "boolean") conditions.push(eq(tasksTable.isActive, isActive));
  if (before) conditions.push(lt(tasksTable.createdAt, new Date(before)));

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(...conditions))
    .orderBy(desc(tasksTable.createdAt))
    .limit(limit + 1);

  const hasMore = tasks.length > limit;
  const items = hasMore ? tasks.slice(0, limit) : tasks;

  res.json({ tasks: items, hasMore });
});

// PATCH /api/admin/tasks/:id — update a task
router.patch("/tasks/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({
    name: z.string().min(3).max(200).optional(),
    description: z.string().min(10).max(2000).optional(),
    amount: z.number().min(1).max(100000).optional(),
    isActive: z.boolean().optional(),
    imageUrl: z.string().url().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: any = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.amount) updates.amount = parsed.data.amount.toFixed(2);

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(and(eq(tasksTable.id, (req.params.id as string)), isNull(tasksTable.deletedAt)))
    .returning();

  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  res.json({ success: true, task });
});

// DELETE /api/admin/tasks/:id — soft-delete
router.delete("/tasks/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

  const [task] = await db
    .update(tasksTable)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(tasksTable.id, (req.params.id as string)), isNull(tasksTable.deletedAt)))
    .returning({ id: tasksTable.id });

  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser.id,
    action: "task_deleted",
    targetType: "task",
    targetId: (req.params.id as string),
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "Task deleted" });
});

// GET /api/admin/tasks/submissions — list pending submissions
router.get("/tasks/submissions", async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().optional(),
    status: z.string().default("pending_review"),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, before, status } = parsed.data;

  const conditions: any[] = [eq(taskSubmissionsTable.status, status)];
  if (before) conditions.push(lt(taskSubmissionsTable.createdAt, new Date(before)));

  const submissions = await db
    .select({
      id: taskSubmissionsTable.id,
      taskId: taskSubmissionsTable.taskId,
      userId: taskSubmissionsTable.userId,
      proofImageUrl: taskSubmissionsTable.proofImageUrl,
      notes: taskSubmissionsTable.notes,
      status: taskSubmissionsTable.status,
      createdAt: taskSubmissionsTable.createdAt,
      taskName: tasksTable.name,
      taskAmount: tasksTable.amount,
      userName: profilesTable.name,
      userMobile: profilesTable.mobile,
    })
    .from(taskSubmissionsTable)
    .leftJoin(tasksTable, eq(taskSubmissionsTable.taskId, tasksTable.id))
    .leftJoin(profilesTable, eq(taskSubmissionsTable.userId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(desc(taskSubmissionsTable.createdAt))
    .limit(limit + 1);

  const hasMore = submissions.length > limit;
  const items = hasMore ? submissions.slice(0, limit) : submissions;

  res.json({ submissions: items, hasMore });
});

// PATCH /api/admin/tasks/submissions/:id/approve
router.patch(
  "/tasks/submissions/:id/approve",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    const [submission] = await db
      .select()
      .from(taskSubmissionsTable)
      .where(eq(taskSubmissionsTable.id, (req.params.id as string)))
      .limit(1);

    if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }
    if (submission.status !== "pending_review") {
      res.status(400).json({ error: `Submission already ${submission.status}` });
      return;
    }

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, submission.taskId))
      .limit(1);

    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    await creditWallet({
      userId: submission.userId,
      amount: task.amount,
      currency: "INR",
      type: "task_reward",
      referenceId: submission.id,
      description: `Task reward: ${task.name}`,
      idempotencyKey: `task_reward_${submission.id}`,
    });

    await db
      .update(taskSubmissionsTable)
      .set({
        status: "approved",
        reviewedBy: req.adminUser.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(taskSubmissionsTable.id, submission.id));

    await db.insert(notificationsTable).values({
      userId: submission.userId,
      category: "task",
      title: "Task Approved!",
      message: `Your submission for "${task.name}" was approved. ₹${task.amount} credited to your wallet.`,
      referenceId: submission.id,
      referenceType: "task_submission",
    });

    res.json({ success: true, message: "Submission approved and reward credited" });
  },
);

// PATCH /api/admin/tasks/submissions/:id/reject
router.patch(
  "/tasks/submissions/:id/reject",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.adminUser) { res.status(403).json({ error: "Forbidden" }); return; }

    const schema = z.object({ reason: z.string().min(5).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [submission] = await db
      .select()
      .from(taskSubmissionsTable)
      .where(eq(taskSubmissionsTable.id, (req.params.id as string)))
      .limit(1);

    if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }

    const [task] = await db
      .select({ name: tasksTable.name })
      .from(tasksTable)
      .where(eq(tasksTable.id, submission.taskId))
      .limit(1);

    await db
      .update(taskSubmissionsTable)
      .set({
        status: "rejected",
        rejectedReason: parsed.data.reason,
        reviewedBy: req.adminUser.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(taskSubmissionsTable.id, submission.id));

    await db.insert(notificationsTable).values({
      userId: submission.userId,
      category: "task",
      title: "Task Rejected",
      message: `Your submission for "${task?.name ?? "task"}" was rejected. Reason: ${parsed.data.reason}`,
      referenceId: submission.id,
      referenceType: "task_submission",
    });

    res.json({ success: true, message: "Submission rejected" });
  },
);

export default router;
