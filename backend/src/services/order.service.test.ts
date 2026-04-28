import { OrderStatus } from "@prisma/client";
import { invalidatePendingPaymentOrders } from "./order.service";
import { prisma } from "../lib/prisma";

jest.mock("../lib/prisma", () => ({
  prisma: {
    order: {
      updateMany: jest.fn(),
    },
  },
}));

// Also we need to mock other imports used in order.service.ts
jest.mock("./cart.service", () => ({
  getCart: jest.fn(),
}));

jest.mock("./payos.service", () => ({
  createPaymentLink: jest.fn(),
}));

jest.mock("../lib/redis", () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));


describe("Order Service", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("invalidatePendingPaymentOrders", () => {
    it("should call prisma.order.updateMany with the correct parameters", async () => {
      const telegramId = "123456789";
      const mockCount = 2;

      (prisma.order.updateMany as jest.Mock).mockResolvedValue({ count: mockCount });

      const result = await invalidatePendingPaymentOrders(telegramId);

      expect(prisma.order.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          telegramId,
          status: OrderStatus.PENDING_PAYMENT,
        },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });
      expect(result).toBe(mockCount);
    });
  });
});
