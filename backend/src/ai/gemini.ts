import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env";
import { SYSTEM_INSTRUCTION } from "./prompts";
import {
  addToCartDeclaration,
  viewCartDeclaration,
  editCartDeclaration,
  checkoutCartDeclaration,
} from "./tools";
import {
  addToCart,
  clearCart,
  getCart,
  getCartOrderNote,
  keepOnlyCartItems,
  removeCartItems,
  setCartOrderNote,
  updateCartItems,
  type CartItemSelector,
} from "../services/cart.service";
import {
  checkout,
  invalidatePendingPaymentOrders,
} from "../services/order.service";
import { getMenuPromptText } from "../services/menu.service";

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const RETRY_ATTEMPTS = Number(process.env.GEMINI_RETRY_ATTEMPTS || 8);
const RETRY_BASE_DELAY_MS = Number(
  process.env.GEMINI_RETRY_BASE_DELAY_MS || 1200,
);
const RETRY_MAX_DELAY_MS = Number(
  process.env.GEMINI_RETRY_MAX_DELAY_MS || 12000,
);
const CHAT_SESSION_TTL_MS = Number(
  process.env.GEMINI_SESSION_TTL_MS || 30 * 60 * 1000,
);
const CHAT_SESSION_MAX_SIZE = Number(
  process.env.GEMINI_SESSION_MAX_SIZE || 2000,
);
const CHAT_SESSION_CLEANUP_INTERVAL_MS = Number(
  process.env.GEMINI_SESSION_CLEANUP_INTERVAL_MS || 5 * 60 * 1000,
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractErrorText = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isRetryableGeminiError = (error: unknown) => {
  const errorText = extractErrorText(error).toLowerCase();
  return (
    errorText.includes("429") ||
    errorText.includes("503") ||
    errorText.includes("resource_exhausted") ||
    errorText.includes("rate") ||
    errorText.includes("quota") ||
    errorText.includes("overloaded") ||
    errorText.includes("temporarily unavailable") ||
    errorText.includes("timeout") ||
    errorText.includes("deadline") ||
    errorText.includes("server busy")
  );
};

const sendMessageWithRetry = async (chat: any, payload: unknown) => {
  let attempt = 0;

  while (true) {
    try {
      return await chat.sendMessage(payload);
    } catch (error) {
      attempt += 1;

      if (!isRetryableGeminiError(error) || attempt >= RETRY_ATTEMPTS) {
        throw error;
      }

      const expDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 400);
      const retryDelayMs = Math.min(RETRY_MAX_DELAY_MS, expDelay + jitter);

      console.warn(
        `Gemini busy/rate limited. Retry ${attempt}/${RETRY_ATTEMPTS} in ${retryDelayMs}ms`,
      );

      await sleep(retryDelayMs);
    }
  }
};

const CHECKOUT_INTENT_REGEX =
  /\b(thanh\s*toan|thanh\s*toán|checkout|chot\s*don|chốt\s*đơn|tinh\s*tien|tính\s*tiền)\b/i;
const ORDER_NOTE_INTENT_REGEX =
  /\b(note|ghi\s*chu|ghi\s*chú|ghi\s*lại|dặn|nhắn)\b/i;

const PAYOS_LINK_REGEX = /https?:\/\/pay\.payos\.vn\/\S+/i;

export const chatModel = genAI.getGenerativeModel({
  model: config.GEMINI_MODEL,
  systemInstruction: SYSTEM_INSTRUCTION,
  tools: [
    {
      functionDeclarations: [
        addToCartDeclaration,
        viewCartDeclaration,
        editCartDeclaration,
        checkoutCartDeclaration,
      ],
    },
  ],
});

// Cache history trên Object Tạm (Nếu server scale multi-node thì phải đưa đoạn history này vào Redis)
type ChatSession = ReturnType<typeof chatModel.startChat>;
type ChatSessionEntry = {
  chat: ChatSession;
  lastActiveAt: number;
};

const chatSessions = new Map<number, ChatSessionEntry>(); //Map trong RAM (bộ nhớ của server).
// chatSessions = {
//     userId1 -> chatSession1,
//     userId2 -> chatSession2
//   }

const touchSession = (userId: number, chat: ChatSession) => {
  chatSessions.set(userId, {
    chat,
    lastActiveAt: Date.now(),
  });
};

const cleanupExpiredSessions = () => {
  const now = Date.now();

  for (const [userId, entry] of chatSessions.entries()) {
    if (now - entry.lastActiveAt > CHAT_SESSION_TTL_MS) {
      chatSessions.delete(userId);
    }
  }

  if (chatSessions.size <= CHAT_SESSION_MAX_SIZE) {
    return;
  }

  const overflow = chatSessions.size - CHAT_SESSION_MAX_SIZE;
  const oldestEntries = [...chatSessions.entries()]
    .sort((a, b) => a[1].lastActiveAt - b[1].lastActiveAt)
    .slice(0, overflow);

  for (const [userId] of oldestEntries) {
    chatSessions.delete(userId);
  }
};

const cleanupTimer = setInterval(
  cleanupExpiredSessions,
  CHAT_SESSION_CLEANUP_INTERVAL_MS,
);
cleanupTimer.unref?.();

const getOrCreateSession = (userId: number) => {
  cleanupExpiredSessions();

  const existingSession = chatSessions.get(userId);
  if (existingSession) {
    touchSession(userId, existingSession.chat);
    return existingSession.chat;
  }

  const newSession = chatModel.startChat({ history: [] });
  touchSession(userId, newSession);
  return newSession;
};

export const handleAIFlow = async (
  userId: number,
  userName: string,
  userPrompt: string,
): Promise<string> => {
  try {
    const menuContext = await getMenuPromptText();

    // 1. Tạo session hoặc lấy history cũ
    const chat = getOrCreateSession(userId);

    // 2. Gửi text cho Gemini
    const promptWithMenu = `${menuContext}\n\nTin nhan khach hang: ${userPrompt}`;
    let response = await sendMessageWithRetry(chat, promptWithMenu);
    let aiMessage = response.response;
    const executedCalls = new Set<string>();
    const MAX_FUNCTION_CALLS_PER_TURN = 5;
    let functionCallCount = 0;

    // 3. VÒNG LẶP FUNCTION CALLING: Nếu Gemini "muốn" gọi hàm
    while (aiMessage.functionCalls()?.length > 0) {
      if (functionCallCount >= MAX_FUNCTION_CALLS_PER_TURN) {
        return "Xin lỗi anh/chị, hệ thống đang bận. Vui lòng thử lại sau.";
      }

      const call = aiMessage.functionCalls()[0]; // Lấy hàm đầu tiên
      const funcName = call.name;
      const args = call.args;
      functionCallCount += 1;

      const callKey = `${funcName}:${JSON.stringify(args)}`;
      if (executedCalls.has(callKey)) {
        return "Yêu cầu đang được xử lý, vui lòng đợi trong giây lát.";
      }
      executedCalls.add(callKey);

      console.log(
        `🤖 AI is calling function: ${funcName} with arguments:`,
        args,
      );

      let functionResult: any = {};

      // THỰC THI HÀM VỚI REDIS
      if (funcName === "add_item_to_cart") {
        await addToCart(userId, {
          productId: args.productId,
          productName: args.productName,
          size: args.size,
          toppings: args.toppings || [],
          note: args.note || "",
          quantity: args.quantity,
        });
        await invalidatePendingPaymentOrders(String(userId));
        functionResult = {
          status: "success",
          message: `Đã thêm ${args.quantity} ly ${args.productName} vào giỏ.`,
          paymentLinkInvalidated: true,
        };
      } else if (funcName === "view_user_cart") {
        const currentCart = await getCart(userId);
        functionResult = { status: "success", cart: currentCart };
      } else if (funcName === "edit_user_cart") {
        const action = typeof args.action === "string" ? args.action : "";
        const selector = (args.selector || {}) as CartItemSelector;

        if (action === "remove") {
          const result = await removeCartItems(userId, selector);
          if (result.removedCount > 0) {
            await invalidatePendingPaymentOrders(String(userId));
          }
          functionResult = {
            status: "success",
            message: `Da bo ${result.removedCount} mon khoi gio.`,
            cart: result.cart,
            paymentLinkInvalidated: result.removedCount > 0,
          };
        } else if (action === "keep_only") {
          const keepSelectors = Array.isArray(args.keepSelectors)
            ? (args.keepSelectors as CartItemSelector[])
            : [];
          const result = await keepOnlyCartItems(userId, keepSelectors);
          if (result.removedCount > 0) {
            await invalidatePendingPaymentOrders(String(userId));
          }
          functionResult = {
            status: "success",
            message: `Da giu lai ${result.keptCount} mon va bo ${result.removedCount} mon.`,
            cart: result.cart,
            paymentLinkInvalidated: result.removedCount > 0,
          };
        } else if (action === "update") {
          const updates = (args.updates || {}) as {
            note?: string;
            toppings?: string[];
            quantity?: number;
            size?: "M" | "L";
          };
          const result = await updateCartItems(userId, selector, updates);
          if (result.updatedCount > 0) {
            await invalidatePendingPaymentOrders(String(userId));
          }
          functionResult = {
            status: "success",
            message: `Da cap nhat ${result.updatedCount} mon trong gio.`,
            cart: result.cart,
            paymentLinkInvalidated: result.updatedCount > 0,
          };
        } else if (action === "set_order_note") {
          const orderNote =
            typeof args?.updates?.note === "string"
              ? args.updates.note
              : typeof args.note === "string"
                ? args.note
                : "";
          const savedNote = await setCartOrderNote(userId, orderNote);

          if (savedNote) {
            await invalidatePendingPaymentOrders(String(userId));
          }

          functionResult = {
            status: "success",
            message: savedNote
              ? `Da luu ghi chu chung cho toan don: ${savedNote}`
              : "Da xoa ghi chu chung cua toan don.",
            note: savedNote,
            paymentLinkInvalidated: savedNote.length > 0,
          };
        } else if (action === "clear") {
          await clearCart(userId);
          await invalidatePendingPaymentOrders(String(userId));
          functionResult = {
            status: "success",
            message: "Da xoa toan bo gio hang.",
            cart: [],
            paymentLinkInvalidated: true,
          };
        } else {
          functionResult = {
            status: "error",
            message: "Khong hieu yeu cau chinh sua gio hang.",
          };
        }
      } else if (funcName === "checkout_cart") {
        const hasCheckoutIntent = CHECKOUT_INTENT_REGEX.test(userPrompt);
        const hasOrderNoteIntent = ORDER_NOTE_INTENT_REGEX.test(userPrompt);

        if (hasOrderNoteIntent && !hasCheckoutIntent) {
          const orderNote =
            typeof args?.note === "string" ? args.note : userPrompt;
          const savedNote = await setCartOrderNote(userId, orderNote);

          if (savedNote) {
            await invalidatePendingPaymentOrders(String(userId));
          }

          functionResult = {
            status: "success",
            note: savedNote,
            paymentLinkInvalidated: savedNote.length > 0,
            message: savedNote
              ? `Da luu ghi chu chung cho toan don: ${savedNote}`
              : "Da xoa ghi chu chung cua toan don.",
          };

          response = await sendMessageWithRetry(chat, [
            {
              functionResponse: {
                name: "edit_user_cart",
                response: functionResult,
              },
            },
          ]);

          aiMessage = response.response;
          continue;
        }

        const existingOrderNote = await getCartOrderNote(userId);
        const result = await checkout(
          String(userId),
          userName,
          args.note || existingOrderNote,
        );
        const checkoutError =
          "error" in result && typeof result.error === "string"
            ? result.error
            : null;

        functionResult = checkoutError
          ? { status: "error", message: checkoutError }
          : {
              status: "success",
              orderId: result.orderId,
              orderCode: result.orderCode,
              totalPrice: result.totalPrice,
              checkoutUrl: result.checkoutUrl,
              message: "Đơn hàng đã được chốt!",
            };
      }

      // GỬI KẾT QUẢ CỦA HÀM NGƯỢC XUỐNG CHO AI
      // AI sẽ dùng kết quả này để "nói" câu cuối cùng với khách
      response = await sendMessageWithRetry(chat, [
        {
          functionResponse: {
            name: funcName,
            response: functionResult,
          },
        },
      ]);

      aiMessage = response.response;

      if (funcName === "checkout_cart") {
        if (functionResult.status === "error") {
          return functionResult.message;
        }

        return [
          `Đơn #${functionResult.orderId} đã được tạo.`,
          `Tổng tiền: ${functionResult.totalPrice.toLocaleString("vi-VN")}đ`,
          `Thanh toán tại đây: ${functionResult.checkoutUrl}`,
          "Sau khi thanh toán thành công, mình sẽ tự cập nhật trạng thái đơn cho bạn.",
        ].join("\n");
      }
    }

    // KHI AI TRẢ LỜI NGÔN NGỮ TỰ NHIÊN (TEXT)
    const finalText = aiMessage.text();

    if (
      PAYOS_LINK_REGEX.test(finalText) &&
      !CHECKOUT_INTENT_REGEX.test(userPrompt)
    ) {
      return "Dạ em đã cập nhật giỏ hàng theo yêu cầu. Link thanh toán cũ không còn hiệu lực, khi anh/chị muốn trả tiền thì nhắn 'thanh toán' để em tạo link mới đúng với giỏ hiện tại nhé.";
    }

    return finalText;
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "Xin lỗi anh/chị, hệ thống đang quá tải. Em đã tự thử lại nhiều lần nhưng chưa thành công, anh/chị thử lại giúp em sau ít phút nhé.";
  }
};
