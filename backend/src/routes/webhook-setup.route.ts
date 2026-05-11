import { Router } from "express";
import { setupWebhookHandler } from "../controllers/webhook-setup.controller";

const router = Router();

router.post("/", setupWebhookHandler);

export default router;
