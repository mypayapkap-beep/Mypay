import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bannersTable, announcementsTable, settingsTable } from "@workspace/db";
import { eq, and, or, isNull, lte, gte, desc, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/public/banners — active banners (no auth)
router.get("/public/banners", async (req, res): Promise<void> => {
  const now = new Date();

  const banners = await db
    .select()
    .from(bannersTable)
    .where(
      and(
        eq(bannersTable.isActive, true),
        or(isNull(bannersTable.startsAt), lte(bannersTable.startsAt, now)),
        or(isNull(bannersTable.endsAt), gte(bannersTable.endsAt, now)),
      ),
    )
    .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));

  res.json({ banners });
});

// GET /api/public/announcements — active announcements (no auth)
router.get("/public/announcements", async (req, res): Promise<void> => {
  const now = new Date();

  const announcements = await db
    .select()
    .from(announcementsTable)
    .where(
      and(
        eq(announcementsTable.isActive, true),
        or(isNull(announcementsTable.startsAt), lte(announcementsTable.startsAt, now)),
        or(isNull(announcementsTable.endsAt), gte(announcementsTable.endsAt, now)),
      ),
    )
    .orderBy(desc(announcementsTable.isPinned), desc(announcementsTable.createdAt));

  res.json({ announcements });
});

// GET /api/public/settings — public app settings (no auth)
router.get("/public/settings", async (req, res): Promise<void> => {
  const settings = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.isPublic, true));

  const asMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  res.json({ settings: asMap });
});

// GET /api/public/check-mobile — check if mobile is registered
router.get("/public/check-mobile", async (req, res): Promise<void> => {
  const mobile = req.query.mobile as string;
  if (!mobile || !/^\+91[6-9]\d{9}$/.test(mobile)) {
    res.status(400).json({ error: "Invalid mobile number" });
    return;
  }

  const { profilesTable } = await import("@workspace/db");
  const [existing] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.mobile, mobile))
    .limit(1);

  res.json({ registered: !!existing });
});

export default router;
