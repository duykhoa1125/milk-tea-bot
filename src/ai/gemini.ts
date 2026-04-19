import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env";
import { MENU_DATA, SYSTEM_INSTRUCTION } from "./prompts";
import { addToCartDeclaration, viewCartDeclaration } from "./tools";
import { addToCart, getCart } from "../services/cart.service";

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export const chatModel = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
    systemInstruction: SYSTEM_INSTRUCTION + "\n\n" + MENU_DATA,
    tools: [
        {
            functionDeclarations: [addToCartDeclaration, viewCartDeclaration]
        }
    ]
});

// Cache history trên Object Tạm (Nếu server scale multi-node thì phải đưa đoạn history này vào Redis)
const chatSessions = new Map() //Map trong RAM (bộ nhớ của server).
// chatSessions = {
//     userId1 -> chatSession1,
//     userId2 -> chatSession2
//   }

export const handleAIFlow = async (userId: number, userPrompt: string): Promise<string> => {
    try {
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
        let response = await chat.sendMessage(userPrompt);
        let aiMessage = response.response;

        // 3. VÒNG LẶP FUNCTION CALLING: Nếu Gemini "muốn" gọi hàm
        while (aiMessage.functionCalls()?.length > 0) {
            const call = aiMessage.functionCalls()[0]; // Lấy hàm đầu tiên
            const funcName = call.name;
            const args = call.args;

            console.log(`🤖 AI is calling function: ${funcName} with arguments:`, args);

            let functionResult: any = {};

            // THỰC THI HÀM VỚI REDIS
            if (funcName === 'add_item_to_cart') {
                await addToCart(userId, {
                    productName: args.productName,
                    size: args.size,
                    toppings: args.toppings || [],
                    note: args.note || '',
                    quantity: args.quantity
                });
                functionResult = { status: "success", message: `Đã thêm ${args.quantity} ly ${args.productName} vào giỏ.` };
            }
            else if (funcName === 'view_user_cart') {
                const currentCart = await getCart(userId);
                functionResult = { status: "success", cart: currentCart };
            }

            // GỬI KẾT QUẢ CỦA HÀM NGƯỢC XUỐNG CHO AI 
            // AI sẽ dùng kết quả này để "nói" câu cuối cùng với khách
            response = await chat.sendMessage([{
                functionResponse: {
                    name: funcName,
                    response: functionResult
                }
            }]);

            aiMessage = response.response;
        }

        // KHI AI TRẢ LỜI NGÔN NGỮ TỰ NHIÊN (TEXT)
        return aiMessage.text();

    } catch (error) {
        console.error("Error generating AI response:", error);
        return "Xin lỗi anh/chị, hệ thống đang bận. Vui lòng thử lại sau.";
    }
}

