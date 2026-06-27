import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const upiAccountsTable = pgTable("upi_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  upiId: text("upi_id").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("pending"),
  isDefault: boolean("is_default").notNull().default(false),
  adminNotes: text("admin_notes"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UpiAccount = typeof upiAccountsTable.$inferSelect;
