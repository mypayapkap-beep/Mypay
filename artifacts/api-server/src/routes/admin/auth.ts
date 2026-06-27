import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { adminUsersTable, adminLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AuthenticatedRequest } from "../../middlewares/auth";

const router: IRouter = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "mypay_admin_secret";

const AdminLoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/admin/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const { username, password } = parsed.data;

  const [admin] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.username, username))
    .limit(1);

  if (!admin) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!admin.isActive) {
    res.status(403).json({ error: "Admin account is deactivated" });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  await db
    .update(adminUsersTable)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsersTable.id, admin.id));

  const token = jwt.sign(
    { adminId: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.json({
    success: true,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email ?? "",
      role: admin.role,
    },
    session: {
      accessToken: token,
    },
  });
});

// POST /api/admin/auth/logout
router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true, message: "Logged out" });
});

// GET /api/admin/auth/me
router.get("/auth/me", async (req: AuthenticatedRequest, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      adminId: string;
      username: string;
      role: string;
    };

    const [admin] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, payload.adminId))
      .limit(1);

    if (!admin || !admin.isActive) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    res.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email ?? "",
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// POST /api/admin/auth/create — create or update admin user
router.post("/auth/create", async (req, res): Promise<void> => {
  const parsed = z.object({
    name: z.string().min(2),
    username: z.string().min(3),
    password: z.string().min(6),
    role: z.enum(["admin", "super_admin"]).default("admin"),
    setupKey: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, username, password, role, setupKey } = parsed.data;

  const setupKeyEnv = process.env.ADMIN_SETUP_KEY;
  let authorized = !!(setupKey && setupKeyEnv && setupKey === setupKeyEnv);

  if (!authorized) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const payload = jwt.verify(token, JWT_SECRET) as any;
        const [caller] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, payload.adminId)).limit(1);
        if (caller?.role === "super_admin" && caller.isActive) authorized = true;
      } catch { /* ignore */ }
    }
  }

  if (!authorized) {
    const existingAdmins = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
    if (existingAdmins.length === 0) authorized = true;
  }

  if (!authorized) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [adminUser] = await db
    .insert(adminUsersTable)
    .values({ username, passwordHash, name, role, isActive: true })
    .onConflictDoUpdate({ target: adminUsersTable.username, set: { passwordHash, name, role, updatedAt: new Date() } })
    .returning();

  res.status(201).json({
    success: true,
    admin: { id: adminUser.id, name: adminUser.name, username: adminUser.username, role: adminUser.role },
  });
});

export default router;
