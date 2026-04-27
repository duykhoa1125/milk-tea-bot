import { Router } from "express";
import {
  getOrderHistoryHandler,
  getOrdersHandler,
  updateOrderStatusHandler,
} from "../controllers/dashboard.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const dashboardRouter = Router();

// Apply authMiddleware to all dashboard routes
dashboardRouter.use(authMiddleware);

dashboardRouter.get("/orders", getOrdersHandler);
dashboardRouter.get("/orders/history", getOrderHistoryHandler);
dashboardRouter.patch("/orders/:id/status", updateOrderStatusHandler);

export default dashboardRouter;
