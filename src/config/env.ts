import "dotenv/config";

//manage environment variables
export const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    PORT: Number(process.env.PORT) || 3000,
    WEBHOOK_URL: process.env.WEBHOOK_URL || '',
}