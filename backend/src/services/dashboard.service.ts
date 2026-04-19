import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const getActiveOrders = async () => {
  return prisma.order.findMany({
    where: {
      status: {
        in: [OrderStatus.PENDING, OrderStatus.COOKING],
      },
    },
    include: {
      user: {
        select: {
          name: true,
          externalId: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
};

export const updateOrderStatus = async (
  orderId: number,
  status: OrderStatus,
) => {
  return prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: {
      user: {
        select: {
          externalId: true,
        },
      },
    },
  });
};
