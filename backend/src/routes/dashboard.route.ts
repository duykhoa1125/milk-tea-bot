import { Router } from "express";
import {
  getOrdersHandler,
  updateOrderStatusHandler,
} from "../controllers/dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/orders", getOrdersHandler);
dashboardRouter.patch("/orders/:id/status", updateOrderStatusHandler);

export default dashboardRouter;
