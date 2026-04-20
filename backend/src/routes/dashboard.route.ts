import { Router } from "express";
import {
  getOrderHistoryHandler,
  getOrdersHandler,
  updateOrderStatusHandler,
} from "../controllers/dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/orders", getOrdersHandler);
dashboardRouter.get("/orders/history", getOrderHistoryHandler);
dashboardRouter.patch("/orders/:id/status", updateOrderStatusHandler);

export default dashboardRouter;
