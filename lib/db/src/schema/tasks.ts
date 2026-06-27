import { pgTable, uuid, numeric, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  durationDays: integer("duration_days").notNull().default(1),
  status: text("status").notNull().default("available"),
  maxSubmissions: integer("max_submissions"),
  totalSubmissions: integer("total_submissions").notNull().default(0),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Task = typeof tasksTable.$inferSelect;
