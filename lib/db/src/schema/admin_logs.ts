import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin_users";

export const adminLogsTable = pgTable("admin_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => adminUsersTable.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminLog = typeof adminLogsTable.$inferSelect;
