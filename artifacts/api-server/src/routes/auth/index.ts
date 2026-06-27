import { Router, type IRouter } from "express";
import localRouter from "./local";
import sessionRouter from "./session";

const router: IRouter = Router();

router.use("/auth", localRouter);
router.use("/auth", sessionRouter);

export default router;
