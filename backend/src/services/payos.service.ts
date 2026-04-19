import crypto from "node:crypto";
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

const normalizeValue = (value: unknown): unknown => {
  if (value == null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeValue(
          (value as Record<string, unknown>)[key],
        );
        return accumulator;
      }, {});
  }

  return value;
};

const buildSignaturePayload = (data: Record<string, unknown>) => {
  return Object.keys(data)
    .sort()
    .map((key) => {
      const normalizedValue = normalizeValue(data[key]);
      const stringValue = Array.isArray(normalizedValue)
        ? JSON.stringify(normalizedValue)
        : typeof normalizedValue === "object"
          ? JSON.stringify(normalizedValue)
          : String(normalizedValue);

      return `${key}=${encodeURIComponent(stringValue)}`;
    })
    .join("&");
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

export const verifyPayOSWebhookSignature = (payload: PayOSWebhookPayload) => {
  const signaturePayload = buildSignaturePayload(payload.data);
  const expectedSignature = crypto
    .createHmac("sha256", config.PAYOS_CHECKSUM_KEY)
    .update(signaturePayload)
    .digest("hex");

  return expectedSignature.toLowerCase() === payload.signature.toLowerCase();
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
