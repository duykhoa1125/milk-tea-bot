import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const adminKey = req.header("x-admin-key") || "";

  if (!config.ADMIN_API_KEY) {
    res.status(503).json({ error: "ADMIN_API_KEY chưa được cấu hình trên server" });
    return;
  }

  if (adminKey !== config.ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
};
