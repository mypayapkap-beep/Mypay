import { pgTable, uuid, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const withdrawalsTable = pgTable("withdrawals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  upiAccountId: uuid("upi_account_id").notNull(),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  processedBy: uuid("processed_by"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  userSellUpi: text("user_sell_upi"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Withdrawal = typeof withdrawalsTable.$inferSelect;
