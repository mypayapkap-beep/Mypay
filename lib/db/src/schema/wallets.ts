import { pgTable, uuid, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const walletsTable = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }).unique(),
  inrBalance: numeric("inr_balance", { precision: 18, scale: 2 }).notNull().default("0.00"),
  usdtBalance: numeric("usdt_balance", { precision: 18, scale: 8 }).notNull().default("0.00000000"),
  isFrozen: boolean("is_frozen").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Wallet = typeof walletsTable.$inferSelect;
