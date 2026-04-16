import { Bot, webhookCallback } from 'grammy';
import { config } from './../config/env';

//initialize bot
export const bot = new Bot(config.TELEGRAM_BOT_TOKEN)

//common command
bot.command("start", (ctx) => ctx.reply("Chào mừng bạn tới Tiệm Trà Sữa AI! Quý khách muốn dùng gì ạ?"));
bot.command("menu", (ctx) => ctx.reply("Đây là menu của chúng tôi: Trà Sữa Trân Châu, Lục Trà, Hồng Trà..."));

// Module export middleware for Express
export const botWebhook = webhookCallback(bot, 'express');