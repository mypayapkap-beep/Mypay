import { Router, type IRouter } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { profilesTable, walletsTable, referralsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateReferralCode } from "../../lib/referral";
import { createWalletForUser } from "../../lib/wallet";

const router: IRouter = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "mypay_secret_fallback";
const ACCESS_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY = "30d";

function normalizeMobile(raw: string): string {
  const stripped = raw.replace(/[\s\-()]/g, "");
  if (stripped.startsWith("+91") && stripped.length === 13) return stripped;
  if (stripped.startsWith("91") && stripped.length === 12) return `+${stripped}`;
  if (/^[6-9]\d{9}$/.test(stripped)) return `+91${stripped}`;
  return stripped;
}

function makeTokens(userId: string, mobile: string) {
  const accessToken = jwt.sign(
    { userId, mobile, type: "user" },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
  const refreshToken = jwt.sign(
    { userId, type: "user_refresh" },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY },
  );
  const payload = jwt.decode(accessToken) as { exp: number };
  return { accessToken, refreshToken, expiresAt: payload.exp };
}

const RegisterBody = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  mobile: z.string().min(10, "Enter a valid mobile number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6),
  referralCode: z.string().optional(),
});

const LoginBody = z.object({
  mobile: z.string().min(10, "Enter your mobile number"),
  password: z.string().min(1, "Enter your password"),
});

const ResetPasswordBody = z.object({
  mobile: z.string().min(10, "Enter your mobile number"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6),
});

router.post("/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    res.status(400).json({ error: firstError?.message ?? "Invalid input" });
    return;
  }

  const { name, password, confirmPassword, referralCode } = parsed.data;
  const mobile = normalizeMobile(parsed.data.mobile);

  if (!/^\+91[6-9]\d{9}$/.test(mobile)) {
    res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const [existing] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.mobile, mobile))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "This mobile number is already registered." });
    return;
  }

  let sponsorProfile: { id: string } | undefined;
  if (referralCode?.trim()) {
    const [sponsor] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.referralCode, referralCode.trim()))
      .limit(1);
    if (!sponsor) {
      res.status(400).json({ error: "Invalid referral code" });
      return;
    }
    sponsorProfile = sponsor;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newReferralCode = generateReferralCode();

  let profile: typeof profilesTable.$inferSelect;
  try {
    const [inserted] = await db
      .insert(profilesTable)
      .values({
        name: name.trim(),
        mobile,
        passwordHash,
        referralCode: newReferralCode,
        sponsorId: sponsorProfile?.id,
      })
      .returning();
    profile = inserted;
  } catch (err) {
    req.log.error({ err }, "Profile insert failed during registration");
    res.status(500).json({ error: "Registration failed. Please try again." });
    return;
  }

  await createWalletForUser(profile.id);

  if (sponsorProfile) {
    await db.insert(referralsTable).values({
      referrerId: sponsorProfile.id,
      referredId: profile.id,
      level: "A",
      rewardAmount: "200.00",
      rewardStatus: "pending",
    }).onConflictDoNothing();
  }

  const tokens = makeTokens(profile.id, profile.mobile);

  req.log.info({ userId: profile.id }, "User registered via password");

  res.status(201).json({
    success: true,
    user: {
      id: profile.id,
      name: profile.name,
      mobile: profile.mobile,
      referralCode: profile.referralCode,
    },
    session: tokens,
  });
});

router.post("/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    res.status(400).json({ error: firstError?.message ?? "Invalid input" });
    return;
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  const { password } = parsed.data;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.mobile, mobile))
    .limit(1);

  if (!profile) {
    res.status(401).json({ error: "Mobile number not registered" });
    return;
  }

  if (profile.isBlocked) {
    res.status(403).json({ error: "Account is blocked. Contact support." });
    return;
  }
  if (profile.isSuspended) {
    res.status(403).json({ error: "Account is suspended. Contact support." });
    return;
  }

  if (!profile.passwordHash) {
    res.status(401).json({ error: "No password set. Please register again." });
    return;
  }

  const passwordOk = await bcrypt.compare(password, profile.passwordHash);
  if (!passwordOk) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const tokens = makeTokens(profile.id, profile.mobile);

  req.log.info({ userId: profile.id }, "User logged in via password");

  res.json({
    success: true,
    user: {
      id: profile.id,
      name: profile.name,
      mobile: profile.mobile,
      referralCode: profile.referralCode,
    },
    session: tokens,
  });
});

router.post("/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    res.status(400).json({ error: firstError?.message ?? "Invalid input" });
    return;
  }

  const { newPassword, confirmPassword } = parsed.data;
  const mobile = normalizeMobile(parsed.data.mobile);

  if (!/^\+91[6-9]\d{9}$/.test(mobile)) {
    res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const [profile] = await db
    .select({ id: profilesTable.id, isBlocked: profilesTable.isBlocked, isSuspended: profilesTable.isSuspended })
    .from(profilesTable)
    .where(eq(profilesTable.mobile, mobile))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Mobile number not registered" });
    return;
  }

  if (profile.isBlocked) {
    res.status(403).json({ error: "Account is blocked. Contact support." });
    return;
  }

  if (profile.isSuspended) {
    res.status(403).json({ error: "Account is suspended. Contact support." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db
    .update(profilesTable)
    .set({ passwordHash })
    .where(eq(profilesTable.mobile, mobile));

  req.log.info({ mobile }, "Password reset via OTP");

  res.json({ success: true });
});

export default router;
