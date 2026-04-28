import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import { updateOrderStatusHandler } from "../dashboard.controller";
import * as dashboardService from "../../services/dashboard.service";

jest.mock("../../services/dashboard.service");

describe("updateOrderStatusHandler", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      params: { id: "1" },
      body: { status: OrderStatus.DONE },
    };

    res = {
      status: statusMock,
      json: jsonMock,
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it("should update order status successfully", async () => {
    const updatedOrder = {
      id: 1,
      status: OrderStatus.DONE,
      user: { externalId: "test-user-id" },
    };

    (dashboardService.updateOrderStatus as jest.Mock).mockResolvedValue(
      updatedOrder
    );

    // Mock fetch for telegram message
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await updateOrderStatusHandler(req as Request, res as Response);

    expect(dashboardService.updateOrderStatus).toHaveBeenCalledWith(
      1,
      OrderStatus.DONE
    );
    expect(res.json).toHaveBeenCalledWith(updatedOrder);
  });

  it("should return 400 if orderId is invalid", async () => {
    req.params!.id = "invalid";

    await updateOrderStatusHandler(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: "orderId không hợp lệ" });
  });

  it("should return 400 if status is invalid", async () => {
    req.body!.status = "INVALID_STATUS";

    await updateOrderStatusHandler(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: "status không hợp lệ" });
  });

  it("should return 404 if order is not found (Order not found error)", async () => {
    const error = new Error("Order not found");
    (dashboardService.updateOrderStatus as jest.Mock).mockRejectedValue(
      error
    );

    await updateOrderStatusHandler(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Order not found",
    });
  });

  it("should return 500 on generic error", async () => {
    const genericError = new Error("Some generic error");
    (dashboardService.updateOrderStatus as jest.Mock).mockRejectedValue(
      genericError
    );

    await updateOrderStatusHandler(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Failed to update order status",
    });
  });
});
