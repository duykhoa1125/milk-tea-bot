import "dotenv/config";

//manage environment variables
export const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET || "",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3-flash-preview",

    PORT: Number(process.env.PORT) || 3000,
    WEBHOOK_URL: process.env.WEBHOOK_URL || "",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",

    PAYOS_CLIENT_ID: process.env.PAYOS_CLIENT_ID || "",
    PAYOS_API_KEY: process.env.PAYOS_API_KEY || "",
    PAYOS_CHECKSUM_KEY: process.env.PAYOS_CHECKSUM_KEY || "",
};
