import { pgTable, uuid, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  currency: text("currency").notNull().default("INR"),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  status: text("status").notNull().default("pending"),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  description: text("description"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Transaction = typeof transactionsTable.$inferSelect;
