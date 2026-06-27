import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import walletRouter from "./wallet";
import depositsRouter from "./deposits";
import ordersRouter from "./orders";
import upiRouter from "./upi";
import withdrawalsRouter from "./withdrawals";
import tasksRouter from "./tasks";
import referralsRouter from "./referrals";
import notificationsRouter from "./notifications";
import supportRouter from "./support";
import sellRequestsRouter from "./sell_requests";
import sellUpiRouter from "./sell_upi";
import publicRouter from "./public";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(walletRouter);
router.use(depositsRouter);
router.use(ordersRouter);
router.use(upiRouter);
router.use(withdrawalsRouter);
router.use(tasksRouter);
router.use(referralsRouter);
router.use(notificationsRouter);
router.use(supportRouter);
router.use(sellRequestsRouter);
router.use(sellUpiRouter);
router.use(publicRouter);
router.use(adminRouter);

export default router;
