import { pgTable, uuid, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const depositsTable = pgTable("deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  buyOrderId: uuid("buy_order_id"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  utrNumber: text("utr_number"),
  paymentMethod: text("payment_method").notNull(),
  screenshotUrl: text("screenshot_url"),
  status: text("status").notNull().default("paying"),
  adminNotes: text("admin_notes"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  cancelReason: text("cancel_reason"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Deposit = typeof depositsTable.$inferSelect;
