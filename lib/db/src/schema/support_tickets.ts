import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const supportTicketsTable = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "restrict" }),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  status: text("status").notNull().default("open"),
  assignedTo: uuid("assigned_to"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  adminResponse: text("admin_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
