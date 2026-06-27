import { Router, type IRouter } from "express";
import { requireAdmin } from "../../middlewares/auth";
import depositsAdminRouter from "./deposits";
import withdrawalsAdminRouter from "./withdrawals";
import usersAdminRouter from "./users";
import tasksAdminRouter from "./tasks";
import upiAdminRouter from "./upi";
import settingsAdminRouter from "./settings";
import dashboardAdminRouter from "./dashboard";
import authAdminRouter from "./auth";
import supportAdminRouter from "./support";
import bannersAdminRouter from "./banners";
import announcementsAdminRouter from "./announcements";
import buyOrdersAdminRouter from "./buy_orders";
import walletAdjustmentAdminRouter from "./wallet_adjustment";
import diagnosticsAdminRouter from "./diagnostics";
import sellRequestsAdminRouter from "./sell_requests";

const router: IRouter = Router();

// Public admin auth routes (login, create first admin)
router.use("/admin", authAdminRouter);

// All other admin routes require admin auth
router.use("/admin", requireAdmin as any);

router.use("/admin", dashboardAdminRouter);
router.use("/admin", usersAdminRouter);
router.use("/admin", depositsAdminRouter);
router.use("/admin", withdrawalsAdminRouter);
router.use("/admin", tasksAdminRouter);
router.use("/admin", upiAdminRouter);
router.use("/admin", settingsAdminRouter);
router.use("/admin", supportAdminRouter);
router.use("/admin", bannersAdminRouter);
router.use("/admin", announcementsAdminRouter);
router.use("/admin", buyOrdersAdminRouter);
router.use("/admin", walletAdjustmentAdminRouter);
router.use("/admin", diagnosticsAdminRouter);
router.use("/admin", sellRequestsAdminRouter);

export default router;
