import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
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

// In production: serve built frontend static files
// In development: proxy to the Vite dev server on port 5173
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = path.resolve(__dirname, "../../client/dist/public");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // SPA fallback — serve index.html for all non-API routes
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
} else {
  // Dev mode: proxy all non-API traffic to the Vite dev server
  app.use(
    "/",
    createProxyMiddleware({
      target: "http://localhost:5173",
      changeOrigin: true,
      ws: true,
      on: {
        error: (_err, _req, res) => {
          if (res && "writeHead" in res) {
            (res as Response).status(502).send("Vite dev server not ready — start the frontend workflow");
          }
        },
      },
    }),
  );
}

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
