import { pgTable, uuid, numeric, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const buyOrdersTable = pgTable("buy_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("upi"),
  upiId: text("upi_id"),
  name: text("name"),
  accountNumber: text("account_number"),
  ifscCode: text("ifsc_code"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  maxClaims: integer("max_claims").notNull().default(1),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BuyOrder = typeof buyOrdersTable.$inferSelect;
