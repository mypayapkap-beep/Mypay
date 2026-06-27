import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const walletLockLogsTable = pgTable("wallet_lock_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  performedBy: uuid("performed_by"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WalletLockLog = typeof walletLockLogsTable.$inferSelect;
