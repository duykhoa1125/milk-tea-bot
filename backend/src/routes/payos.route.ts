import { Router } from "express";
import {
  handlePayOSCancelRedirect,
  handlePayOSWebhook,
} from "../controllers/payos.controller";

const router = Router();

router.post("/webhook", handlePayOSWebhook);
router.get("/cancel", handlePayOSCancelRedirect);

export default router;
