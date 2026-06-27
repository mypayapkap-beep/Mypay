import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  supabaseUid: text("supabase_uid").unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  mobile: text("mobile").unique().notNull(),
  referralCode: text("referral_code").unique().notNull(),
  sponsorId: text("sponsor_id"),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").notNull().default(true),
  isSuspended: boolean("is_suspended").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  sellUpiId: text("sell_upi_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profilesTable.$inferSelect;
