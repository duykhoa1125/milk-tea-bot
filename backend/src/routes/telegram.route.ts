import { Router } from "express";
import { handleTelegramWebhook } from "../controllers/telegram.controller";

const router = Router();

router.post("/", handleTelegramWebhook);

export default router;
