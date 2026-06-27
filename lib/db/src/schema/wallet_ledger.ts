import { pgTable, uuid, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const walletLedgerTable = pgTable("wallet_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  currency: text("currency").notNull().default("INR"),
  type: text("type").notNull(),
  referenceId: text("reference_id"),
  beforeBalance: numeric("before_balance", { precision: 18, scale: 8 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  afterBalance: numeric("after_balance", { precision: 18, scale: 8 }).notNull(),
  description: text("description"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WalletLedger = typeof walletLedgerTable.$inferSelect;
