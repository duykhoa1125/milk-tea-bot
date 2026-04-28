import { Router } from "express";
import {
  getOrderHistoryHandler,
  getOrdersHandler,
  updateOrderStatusHandler,
} from "../controllers/dashboard.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const dashboardRouter = Router();

dashboardRouter.get("/orders", authMiddleware, getOrdersHandler);
dashboardRouter.get("/orders/history", authMiddleware, getOrderHistoryHandler);
dashboardRouter.patch("/orders/:id/status", authMiddleware, updateOrderStatusHandler);

export default dashboardRouter;
