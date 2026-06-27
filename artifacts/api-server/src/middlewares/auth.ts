import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { profilesTable, adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET ?? "mypay_secret_fallback";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    supabaseUid: string | null;
    mobile: string;
    name: string;
    referralCode: string;
    isActive: boolean;
    isSuspended: boolean;
    isBlocked: boolean;
  };
  adminUser?: {
    id: string;
    supabaseUid: string;
    name: string;
    email: string;
    role: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  let payload: { userId: string; mobile: string; type: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: string; mobile: string; type: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  if (payload.type !== "user") {
    res.status(401).json({ error: "Invalid token type" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, payload.userId))
    .limit(1);

  if (!profile) {
    res.status(401).json({ error: "User profile not found" });
    return;
  }

  if (profile.isBlocked) {
    res.status(403).json({ error: "Account is blocked" });
    return;
  }

  if (profile.isSuspended) {
    res.status(403).json({ error: "Account is suspended" });
    return;
  }

  req.user = {
    id: profile.id,
    supabaseUid: profile.supabaseUid,
    mobile: profile.mobile,
    name: profile.name ?? "",
    referralCode: profile.referralCode,
    isActive: profile.isActive,
    isSuspended: profile.isSuspended,
    isBlocked: profile.isBlocked,
  };

  next();
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(
      token,
      process.env.SESSION_SECRET ?? "mypay_admin_secret",
    ) as { adminId: string; username: string; role: string };

    const [admin] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, payload.adminId))
      .limit(1);

    if (!admin || !admin.isActive) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    req.adminUser = {
      id: admin.id,
      supabaseUid: admin.supabaseUid ?? "",
      name: admin.name,
      email: admin.email ?? "",
      role: admin.role,
    };

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(roles: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.adminUser) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    if (!roles.includes(req.adminUser.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
