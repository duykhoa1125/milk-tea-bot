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
  keepOnlyCartItems,
  removeCartItems,
  updateCartItems,
  type CartItemSelector,
} from "../services/cart.service";
import { checkout } from "../services/order.service";
import { getMenuPromptText } from "../services/menu.service";

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

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
const chatSessions = new Map(); //Map trong RAM (bộ nhớ của server).
// chatSessions = {
//     userId1 -> chatSession1,
//     userId2 -> chatSession2
//   }

export const handleAIFlow = async (
  userId: number,
  userName: string,
  userPrompt: string,
): Promise<string> => {
  try {
    const menuContext = await getMenuPromptText();

    // 1. Tạo session hoặc lấy history cũ
    if (!chatSessions.has(userId)) {
      chatSessions.set(userId, chatModel.startChat({ history: [] }));

      // chatModel.startChat = {
      //     history: [
      //         { role: "user", content: "Hi" },
      //         { role: "model", content: "Hello" },
      //         ...
      //     ]
      //   }
    }

    const chat = chatSessions.get(userId);

    // 2. Gửi text cho Gemini
    const promptWithMenu = `${menuContext}\n\nTin nhan khach hang: ${userPrompt}`;
    let response = await chat.sendMessage(promptWithMenu);
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
        functionResult = {
          status: "success",
          message: `Đã thêm ${args.quantity} ly ${args.productName} vào giỏ.`,
        };
      } else if (funcName === "view_user_cart") {
        const currentCart = await getCart(userId);
        functionResult = { status: "success", cart: currentCart };
      } else if (funcName === "edit_user_cart") {
        const action = typeof args.action === "string" ? args.action : "";
        const selector = (args.selector || {}) as CartItemSelector;

        if (action === "remove") {
          const result = await removeCartItems(userId, selector);
          functionResult = {
            status: "success",
            message: `Da bo ${result.removedCount} mon khoi gio.`,
            cart: result.cart,
          };
        } else if (action === "keep_only") {
          const keepSelectors = Array.isArray(args.keepSelectors)
            ? (args.keepSelectors as CartItemSelector[])
            : [];
          const result = await keepOnlyCartItems(userId, keepSelectors);
          functionResult = {
            status: "success",
            message: `Da giu lai ${result.keptCount} mon va bo ${result.removedCount} mon.`,
            cart: result.cart,
          };
        } else if (action === "update") {
          const updates = (args.updates || {}) as {
            note?: string;
            toppings?: string[];
            quantity?: number;
            size?: "M" | "L";
          };
          const result = await updateCartItems(userId, selector, updates);
          functionResult = {
            status: "success",
            message: `Da cap nhat ${result.updatedCount} mon trong gio.`,
            cart: result.cart,
          };
        } else if (action === "clear") {
          await clearCart(userId);
          functionResult = {
            status: "success",
            message: "Da xoa toan bo gio hang.",
            cart: [],
          };
        } else {
          functionResult = {
            status: "error",
            message: "Khong hieu yeu cau chinh sua gio hang.",
          };
        }
      } else if (funcName === "checkout_cart") {
        const result = await checkout(String(userId), userName, args.note);
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
      response = await chat.sendMessage([
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
    return aiMessage.text();
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "Xin lỗi anh/chị, hệ thống đang bận. Vui lòng thử lại sau.";
  }
};
