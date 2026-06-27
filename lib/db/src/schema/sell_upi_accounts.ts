import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const sellUpiAccountsTable = pgTable(
  "sell_upi_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
    upiId: text("upi_id").notNull(),
    accountHolderName: text("account_holder_name").notNull(),
    provider: text("provider").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type SellUpiAccount = typeof sellUpiAccountsTable.$inferSelect;
