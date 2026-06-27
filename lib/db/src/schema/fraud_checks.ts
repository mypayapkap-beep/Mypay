import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const fraudChecksTable = pgTable("fraud_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profilesTable.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  ipAddress: text("ip_address"),
  deviceFingerprint: text("device_fingerprint"),
  riskScore: integer("risk_score").notNull().default(0),
  isFlagged: boolean("is_flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  metadata: text("metadata"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FraudCheck = typeof fraudChecksTable.$inferSelect;
