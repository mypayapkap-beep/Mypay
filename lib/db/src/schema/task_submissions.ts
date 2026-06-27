import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";
import { tasksTable } from "./tasks";

export const taskSubmissionsTable = pgTable("task_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "restrict" }),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  proofImageUrl: text("proof_image_url").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending_review"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TaskSubmission = typeof taskSubmissionsTable.$inferSelect;
