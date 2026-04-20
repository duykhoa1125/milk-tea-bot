import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

type HistoryQueryInput = {
  page: number;
  limit: number;
  statuses?: OrderStatus[];
};

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

export const getOrderHistory = async ({
  page,
  limit,
  statuses,
}: HistoryQueryInput) => {
  const where = statuses && statuses.length > 0 ? { status: { in: statuses } } : {};
  const skip = (page - 1) * limit;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
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
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};
