import { Router } from "express";
import { handlePayOSWebhook } from "../controllers/payos.controller";

const router = Router();

router.post("/", handlePayOSWebhook);

export default router;
