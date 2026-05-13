import express from "express";
import cors from "cors";
import { config } from "./config/env";
import dashboardRouter from "./routes/dashboard.route";
import healthRouter from "./routes/health.route";
import telegramRouter from "./routes/telegram.route";
import payosRouter from "./routes/payos.route";
import webhookSetupRouter from "./routes/webhook-setup.route";

const app = express();

// Middleware
app.use(
  cors({
    origin: config.FRONTEND_URL,
    methods: ["GET", "PATCH", "POST"],
  }),
);

app.use(express.json());

// Routes
app.use("/health", healthRouter);
app.use("/webhook", telegramRouter);
app.use("/api/orders", dashboardRouter);
app.use("/payos", payosRouter);
app.use("/setup-webhook", webhookSetupRouter);

export default app;
