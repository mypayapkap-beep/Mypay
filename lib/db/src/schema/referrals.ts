import { pgTable, uuid, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const referralsTable = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  referredId: uuid("referred_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }).unique(),
  level: text("level").notNull().default("A"),
  rewardAmount: numeric("reward_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
  rewardStatus: text("reward_status").notNull().default("pending"),
  rewardPaidAt: timestamp("reward_paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
