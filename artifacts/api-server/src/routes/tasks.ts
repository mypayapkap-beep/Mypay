import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { tasksTable, taskSubmissionsTable } from "@workspace/db";
import { eq, and, desc, lt, isNull } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { creditWallet, generateIdempotencyKey } from "../lib/wallet";

const router: IRouter = Router();

// GET /api/tasks — list available tasks
router.get(
  "/tasks",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      before: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit, before } = parsed.data;

    const conditions = [
      eq(tasksTable.isActive, true),
      isNull(tasksTable.deletedAt),
    ];
    if (before) conditions.push(lt(tasksTable.createdAt, new Date(before)));

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(and(...conditions))
      .orderBy(desc(tasksTable.createdAt))
      .limit(limit + 1);

    const hasMore = tasks.length > limit;
    const items = hasMore ? tasks.slice(0, limit) : tasks;

    res.json({
      tasks: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

// GET /api/tasks/submissions — list my submissions (MUST be before /tasks/:id)
router.get(
  "/tasks/submissions",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      before: z.string().optional(),
      status: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit, before, status } = parsed.data;

    const conditions = [eq(taskSubmissionsTable.userId, req.user.id)];
    if (status) conditions.push(eq(taskSubmissionsTable.status, status));
    if (before) conditions.push(lt(taskSubmissionsTable.createdAt, new Date(before)));

    const submissions = await db
      .select({
        id: taskSubmissionsTable.id,
        taskId: taskSubmissionsTable.taskId,
        proofImageUrl: taskSubmissionsTable.proofImageUrl,
        notes: taskSubmissionsTable.notes,
        status: taskSubmissionsTable.status,
        rejectedReason: taskSubmissionsTable.rejectedReason,
        reviewedAt: taskSubmissionsTable.reviewedAt,
        createdAt: taskSubmissionsTable.createdAt,
        taskName: tasksTable.name,
        taskAmount: tasksTable.amount,
        taskImageUrl: tasksTable.imageUrl,
      })
      .from(taskSubmissionsTable)
      .leftJoin(tasksTable, eq(taskSubmissionsTable.taskId, tasksTable.id))
      .where(and(...conditions))
      .orderBy(desc(taskSubmissionsTable.createdAt))
      .limit(limit + 1);

    const hasMore = submissions.length > limit;
    const items = hasMore ? submissions.slice(0, limit) : submissions;

    res.json({
      submissions: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

// GET /api/tasks/:id — get task details
router.get(
  "/tasks/:id",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.id, (req.params.id as string)),
          eq(tasksTable.isActive, true),
          isNull(tasksTable.deletedAt),
        ),
      )
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Check if user already submitted this task
    const [submission] = await db
      .select({ id: taskSubmissionsTable.id, status: taskSubmissionsTable.status })
      .from(taskSubmissionsTable)
      .where(
        and(
          eq(taskSubmissionsTable.taskId, task.id),
          eq(taskSubmissionsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    res.json({ task, mySubmission: submission ?? null });
  },
);

// POST /api/tasks/:id/submit — submit task proof
router.post(
  "/tasks/:id/submit",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      proofImageUrl: z.string().url(),
      notes: z.string().max(500).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.id, (req.params.id as string)),
          eq(tasksTable.isActive, true),
          isNull(tasksTable.deletedAt),
        ),
      )
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Check max submissions
    if (task.maxSubmissions !== null && task.totalSubmissions >= task.maxSubmissions) {
      res.status(400).json({ error: "Task submission limit reached" });
      return;
    }

    // Check if user already submitted
    const [existing] = await db
      .select({ id: taskSubmissionsTable.id, status: taskSubmissionsTable.status })
      .from(taskSubmissionsTable)
      .where(
        and(
          eq(taskSubmissionsTable.taskId, task.id),
          eq(taskSubmissionsTable.userId, req.user.id),
        ),
      )
      .limit(1);

    if (existing) {
      res.status(409).json({
        error: "You have already submitted this task",
        status: existing.status,
      });
      return;
    }

    const { proofImageUrl, notes } = parsed.data;

    const [submission] = await db
      .insert(taskSubmissionsTable)
      .values({
        taskId: task.id,
        userId: req.user.id,
        proofImageUrl,
        notes,
        status: "pending_review",
      })
      .returning();

    req.log.info(
      { userId: req.user.id, taskId: task.id, submissionId: submission.id },
      "Task submitted",
    );

    res.status(201).json({
      success: true,
      submission: {
        id: submission.id,
        taskId: submission.taskId,
        status: submission.status,
        createdAt: submission.createdAt,
      },
    });
  },
);

// GET /api/tasks/submissions/mine — list my submissions
router.get(
  "/tasks/submissions/mine",
  requireAuth as any,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      before: z.string().optional(),
      status: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit, before, status } = parsed.data;

    const conditions = [eq(taskSubmissionsTable.userId, req.user.id)];
    if (status) conditions.push(eq(taskSubmissionsTable.status, status));
    if (before) conditions.push(lt(taskSubmissionsTable.createdAt, new Date(before)));

    const submissions = await db
      .select({
        id: taskSubmissionsTable.id,
        taskId: taskSubmissionsTable.taskId,
        proofImageUrl: taskSubmissionsTable.proofImageUrl,
        notes: taskSubmissionsTable.notes,
        status: taskSubmissionsTable.status,
        rejectedReason: taskSubmissionsTable.rejectedReason,
        reviewedAt: taskSubmissionsTable.reviewedAt,
        createdAt: taskSubmissionsTable.createdAt,
        taskName: tasksTable.name,
        taskAmount: tasksTable.amount,
        taskImageUrl: tasksTable.imageUrl,
      })
      .from(taskSubmissionsTable)
      .leftJoin(tasksTable, eq(taskSubmissionsTable.taskId, tasksTable.id))
      .where(and(...conditions))
      .orderBy(desc(taskSubmissionsTable.createdAt))
      .limit(limit + 1);

    const hasMore = submissions.length > limit;
    const items = hasMore ? submissions.slice(0, limit) : submissions;

    res.json({
      submissions: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    });
  },
);

export default router;
