import { pgTable, uuid, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const sellRequestsTable = pgTable("sell_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  tokenAmount: numeric("token_amount", { precision: 18, scale: 2 }).notNull(),
  sellAmount: numeric("sell_amount", { precision: 18, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  createdBy: uuid("created_by").notNull(),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedBy: uuid("rejected_by"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SellRequest = typeof sellRequestsTable.$inferSelect;
