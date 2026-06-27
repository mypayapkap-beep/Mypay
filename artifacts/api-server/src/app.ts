import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedDefaultAdmin } from "./lib/seed";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

// Global JSON error handler — must be last; catches all unhandled async errors
app.use((_err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status: number = _err.status ?? _err.statusCode ?? 500;
  const message: string = _err.message ?? "Internal server error";
  logger.error({ err: _err }, "Unhandled error");
  res.status(status).json({ error: message });
});

// Seed admin on startup (non-blocking)
seedDefaultAdmin().catch((err) => logger.error({ err }, "Seed failed"));

export default app;
