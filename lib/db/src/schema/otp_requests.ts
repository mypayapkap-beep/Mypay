import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const otpRequestsTable = pgTable("otp_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  mobile: text("mobile").notNull(),
  purpose: text("purpose").notNull(),
  otpHash: text("otp_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  isUsed: boolean("is_used").notNull().default(false),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OtpRequest = typeof otpRequestsTable.$inferSelect;
