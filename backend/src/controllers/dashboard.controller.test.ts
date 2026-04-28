import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import {
  getOrdersHandler,
  updateOrderStatusHandler,
  getOrderHistoryHandler,
} from "./dashboard.controller";
import * as dashboardService from "../services/dashboard.service";

// Mock the dashboard service
jest.mock("../services/dashboard.service");

// Mock response object
const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

// Mock request object
const mockRequest = (options = {}) => {
  return {
    ...options,
  } as Request;
};

describe("Dashboard Controller", () => {
  let req: Request;
  let res: Response;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as unknown as globalThis.Response);
  });

  describe("getOrdersHandler", () => {
    it("should return active orders successfully", async () => {
      const mockOrders = [
        { id: 1, status: OrderStatus.PENDING },
        { id: 2, status: OrderStatus.COOKING },
      ];
      (dashboardService.getActiveOrders as jest.Mock).mockResolvedValue(
        mockOrders,
      );

      req = mockRequest();
      await getOrdersHandler(req, res);

      expect(dashboardService.getActiveOrders).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    it("should handle errors and return 500", async () => {
      const errorMessage = "Database error";
      (dashboardService.getActiveOrders as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      req = mockRequest();
      await getOrdersHandler(req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching dashboard orders:",
        expect.any(Error),
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Không thể lấy danh sách đơn hàng",
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("updateOrderStatusHandler", () => {
    it("should return 400 for invalid orderId", async () => {
      req = mockRequest({
        params: { id: "invalid" },
        body: { status: OrderStatus.COOKING },
      });

      await updateOrderStatusHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "orderId không hợp lệ" });
    });

    it("should return 400 for missing status", async () => {
      req = mockRequest({
        params: { id: "1" },
        body: {},
      });

      await updateOrderStatusHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "status không hợp lệ" });
    });

    it("should return 400 for invalid status", async () => {
      req = mockRequest({
        params: { id: "1" },
        body: { status: "INVALID_STATUS" },
      });

      await updateOrderStatusHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "status không hợp lệ" });
    });

    it("should update order successfully (status COOKING, no telegram message)", async () => {
      const mockUpdatedOrder = { id: 1, status: OrderStatus.COOKING, user: { externalId: "12345" } };
      (dashboardService.updateOrderStatus as jest.Mock).mockResolvedValue(mockUpdatedOrder);

      req = mockRequest({
        params: { id: "1" },
        body: { status: OrderStatus.COOKING },
      });

      await updateOrderStatusHandler(req, res);

      expect(dashboardService.updateOrderStatus).toHaveBeenCalledWith(1, OrderStatus.COOKING);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUpdatedOrder);
    });

    it("should update order and send telegram message when status is DONE", async () => {
      const mockUpdatedOrder = { id: 1, status: OrderStatus.DONE, user: { externalId: "12345" } };
      (dashboardService.updateOrderStatus as jest.Mock).mockResolvedValue(mockUpdatedOrder);

      req = mockRequest({
        params: { id: "1" },
        body: { status: OrderStatus.DONE },
      });

      const mockBotToken = "TEST_BOT_TOKEN";
      process.env.TELEGRAM_BOT_TOKEN = mockBotToken;

      await updateOrderStatusHandler(req, res);

      expect(dashboardService.updateOrderStatus).toHaveBeenCalledWith(1, OrderStatus.DONE);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockBotToken}/sendMessage`,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: "12345",
            text: `✅ Đơn hàng #1 của bạn đã sẵn sàng! Mời bạn đến lấy đồ nhé ☕`,
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdatedOrder);
    });

    it("should handle missing order error (P2025) and return 404", async () => {
      const error = new Error("Record not found");
      (error as any).code = "P2025";
      (dashboardService.updateOrderStatus as jest.Mock).mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      req = mockRequest({
        params: { id: "999" },
        body: { status: OrderStatus.DONE },
      });

      await updateOrderStatusHandler(req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error updating order status:", error);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Không tìm thấy đơn hàng" });

      consoleErrorSpy.mockRestore();
    });

    it("should handle generic errors and return 500", async () => {
      const error = new Error("Generic failure");
      (dashboardService.updateOrderStatus as jest.Mock).mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      req = mockRequest({
        params: { id: "1" },
        body: { status: OrderStatus.COOKING },
      });

      await updateOrderStatusHandler(req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error updating order status:", error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Không thể cập nhật trạng thái đơn hàng" });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("getOrderHistoryHandler", () => {
    it("should return history with default parameters", async () => {
      const mockHistory = {
        data: [{ id: 1, status: OrderStatus.DONE }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      (dashboardService.getOrderHistory as jest.Mock).mockResolvedValue(mockHistory);

      req = mockRequest({
        query: {},
      });

      await getOrderHistoryHandler(req, res);

      expect(dashboardService.getOrderHistory).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        statuses: [OrderStatus.DONE, OrderStatus.CANCELLED],
      });
      expect(res.json).toHaveBeenCalledWith(mockHistory);
    });

    it("should return 400 for invalid page (less than 1)", async () => {
      req = mockRequest({
        query: { page: "0" },
      });

      await getOrderHistoryHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "page không hợp lệ" });
    });

    it("should return 400 for invalid page (not integer)", async () => {
      req = mockRequest({
        query: { page: "1.5" },
      });

      await getOrderHistoryHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "page không hợp lệ" });
    });

    it("should return 400 for invalid limit (less than 1)", async () => {
      req = mockRequest({
        query: { limit: "0" },
      });

      await getOrderHistoryHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "limit không hợp lệ (1-100)" });
    });

    it("should return 400 for invalid limit (greater than 100)", async () => {
      req = mockRequest({
        query: { limit: "101" },
      });

      await getOrderHistoryHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "limit không hợp lệ (1-100)" });
    });

    it("should allow querying all statuses with ALL", async () => {
      const mockHistory = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
      (dashboardService.getOrderHistory as jest.Mock).mockResolvedValue(mockHistory);

      req = mockRequest({
        query: { status: "ALL" },
      });

      await getOrderHistoryHandler(req, res);

      expect(dashboardService.getOrderHistory).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        statuses: undefined,
      });
      expect(res.json).toHaveBeenCalledWith(mockHistory);
    });

    it("should allow querying specific valid statuses", async () => {
      const mockHistory = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
      (dashboardService.getOrderHistory as jest.Mock).mockResolvedValue(mockHistory);

      req = mockRequest({
        query: { status: "pending, DONE " },
      });

      await getOrderHistoryHandler(req, res);

      expect(dashboardService.getOrderHistory).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        statuses: [OrderStatus.PENDING, OrderStatus.DONE],
      });
      expect(res.json).toHaveBeenCalledWith(mockHistory);
    });

    it("should return 400 for invalid statuses", async () => {
      req = mockRequest({
        query: { status: "DONE,INVALID" },
      });

      await getOrderHistoryHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "status không hợp lệ. Dùng ALL hoặc danh sách: PENDING,COOKING,DONE,CANCELLED",
      });
    });

    it("should handle generic errors and return 500", async () => {
      const errorMessage = "Database failure";
      (dashboardService.getOrderHistory as jest.Mock).mockRejectedValue(new Error(errorMessage));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      req = mockRequest({
        query: {},
      });

      await getOrderHistoryHandler(req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching order history:", expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Không thể lấy lịch sử đơn hàng" });

      consoleErrorSpy.mockRestore();
    });
  });
});
