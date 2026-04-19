import express from "express";
import { config } from "./config/env";
import { bot, botWebhook } from "./bot/instance";
import cors from "cors";
import dashboardRouter from "./routes/dashboard.route";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "PATCH", "POST"],
  }),
);

app.use(express.json());

//telegram transmit webhook to our server
app.post("/webhook", botWebhook);

// Kitchen dashboard API
app.use("/api", dashboardRouter);

//setup webhook manually
//run ngrok http 3000
//copy url from ngrok and paste to WEBHOOK_URL in .env file
//run npm run dev
app.get("/setup-webhook", async (req, res) => {
  try {
    const url = `${config.WEBHOOK_URL}/webhook`;
    await bot.api.setWebhook(url);
    res.send(`Webhook successfully set to: ${url}`);
  } catch (error) {
    console.error("Error setting up webhook:", error);
    res.status(500).send("Error setting up webhook.");
  }
});

app.listen(config.PORT, () => {
  console.log(`🤖 Milk Tea Bot is running on port ${config.PORT}`);
});
