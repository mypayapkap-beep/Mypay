import { db } from "@workspace/db";
import { adminUsersTable, settingsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

export async function seedDefaultAdmin(): Promise<void> {
  try {
    const newUsername = "aslambhai";
    const newPassword = "aslambhai123098";

    const [existingNew] = await db
      .select({ id: adminUsersTable.id })
      .from(adminUsersTable)
      .where(eq(adminUsersTable.username, newUsername))
      .limit(1);

    if (!existingNew) {
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Check if old "admin" user exists and update it
      const [existingOld] = await db
        .select({ id: adminUsersTable.id })
        .from(adminUsersTable)
        .where(eq(adminUsersTable.username, "admin"))
        .limit(1);

      if (existingOld) {
        await db
          .update(adminUsersTable)
          .set({ username: newUsername, passwordHash, name: "MyPay Admin", updatedAt: new Date() })
          .where(eq(adminUsersTable.id, existingOld.id));
        logger.info(`Admin credentials updated to username=${newUsername}`);
      } else {
        await db.insert(adminUsersTable).values({
          username: newUsername,
          passwordHash,
          name: "MyPay Admin",
          role: "super_admin",
          isActive: true,
        });
        logger.info(`Default admin created: username=${newUsername}`);
      }
    }

    // Seed default settings
    const defaultSettings = [
      { key: "referral_level1_reward", value: "200", description: "Direct referral reward after ₹5000 buy volume (INR)", isPublic: false },
      { key: "referral_level2_reward", value: "0", description: "Level A team commission rate (0.3%)", isPublic: false },
      { key: "referral_level3_reward", value: "0", description: "Level B team commission rate (0.1%)", isPublic: false },
      { key: "referral_direct_reward", value: "200", description: "Direct referral claim reward (INR) — credited when user clicks Claim after threshold met", isPublic: false },
      { key: "referral_volume_threshold", value: "5000", description: "Approved buy volume (INR) the referred user must reach before referrer can claim reward", isPublic: false },
      { key: "referral_commission_level_a", value: "0.3", description: "Level A team commission rate (%) — credited automatically on every approved buy order", isPublic: false },
      { key: "referral_commission_level_b", value: "0.1", description: "Level B team commission rate (%) — for indirect referrals", isPublic: false },
      { key: "telegram_bot_username", value: "", description: "Telegram bot username (without @)", isPublic: true },
      { key: "telegram_channel_link", value: "", description: "Telegram channel/group invite link", isPublic: true },
      { key: "telegram_support_username", value: "", description: "Telegram support username", isPublic: true },
      { key: "min_deposit_amount", value: "100", description: "Minimum deposit amount (INR)", isPublic: true },
      { key: "max_deposit_amount", value: "56000", description: "Maximum deposit amount (INR)", isPublic: true },
      { key: "min_withdrawal_amount", value: "200", description: "Minimum withdrawal amount (INR)", isPublic: true },
      { key: "terms_content", value: "", description: "Terms & Rules page content (shown in app)", isPublic: true },
      { key: "admin_buy_upi_id", value: "", description: "Admin Buy UPI ID — users send payment to this UPI when placing buy orders", isPublic: true },
      { key: "admin_sell_upi_id", value: "", description: "Admin Sell UPI ID — admin uses this UPI to pay users on sell request approval", isPublic: false },
      { key: "active_payment_app", value: "phonepe", description: "Active payment app shown to users (phonepe | paytm | mobikwik | airtel)", isPublic: true },
      { key: "income_percentage", value: "5", description: "Buy order income/bonus percentage (e.g. 5 = 5%). Shown on Home page and applied on approval.", isPublic: true },
    ];

    for (const s of defaultSettings) {
      await db.insert(settingsTable).values(s).onConflictDoNothing();
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed default admin");
  }
}
