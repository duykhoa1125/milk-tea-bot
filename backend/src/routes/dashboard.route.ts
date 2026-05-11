import { Router } from "express";
import {
  getOrderHistoryHandler,
  getOrdersHandler,
  updateOrderStatusHandler,
} from "../controllers/dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/", getOrdersHandler);
dashboardRouter.get("/history", getOrderHistoryHandler);
dashboardRouter.patch("/:id/status", updateOrderStatusHandler);

export default dashboardRouter;
