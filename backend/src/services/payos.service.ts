import { PayOS } from "@payos/node";
import { config } from "../config/env";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

const payOS = new PayOS({
  clientId: config.PAYOS_CLIENT_ID,
  apiKey: config.PAYOS_API_KEY,
  checksumKey: config.PAYOS_CHECKSUM_KEY,
});

export type PayOSCheckoutItem = {
  name: string;
  quantity: number;
  price: number;
};

export type PayOSWebhookPayload = {
  code: string;
  desc: string;
  success: boolean;
  data: Record<string, unknown>;
  signature: string;
};

export const createPaymentLink = async (input: {
  orderCode: number;
  amount: number;
  items: PayOSCheckoutItem[];
  description: string;
  returnUrl: string;
  cancelUrl: string;
}) => {
  return payOS.paymentRequests.create(input);
};

export const verifyPayOSWebhookPayload = async (
  payload: PayOSWebhookPayload,
) => {
  return payOS.webhooks.verify(payload as never);
};

export const markOrderAsPaid = async (orderCode: number) => {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderCode },
    include: {
      user: {
        select: {
          externalId: true,
          name: true,
        },
      },
    },
  });

  if (!existingOrder) {
    throw new Error(`Không tìm thấy đơn hàng #${orderCode}`);
  }

  if (existingOrder.status === OrderStatus.PENDING) {
    return {
      order: existingOrder,
      alreadyPaid: true,
    };
  }

  if (existingOrder.status !== OrderStatus.PENDING_PAYMENT) {
    return {
      order: existingOrder,
      alreadyPaid: true,
    };
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderCode },
    data: {
      status: OrderStatus.PENDING,
      paidAt: new Date(),
    },
    include: {
      user: {
        select: {
          externalId: true,
          name: true,
        },
      },
    },
  });

  return {
    order: updatedOrder,
    alreadyPaid: false,
  };
};
