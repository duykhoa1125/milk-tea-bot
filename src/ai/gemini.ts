import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env";
import { MENU_DATA, SYSTEM_INSTRUCTION } from "./prompts";

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export const chatModel = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
    systemInstruction: SYSTEM_INSTRUCTION + "\n\n" + MENU_DATA
});

export const getAIResponse = async (userPrompt: string): Promise<string> => {
    try {
        const result = await chatModel.generateContent(userPrompt);
        return result.response.text();
    } catch (error) {
        console.error("Error generating AI response:", error);
        return "Xin lỗi, tôi đang gặp chút vấn đề. Vui lòng thử lại sau.";
    }
}
