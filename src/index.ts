import express from 'express';
import { config } from './config/env';
import { bot, botWebhook } from './bot/instance';

const app = express()

app.use(express.json());

//telegram transmit webhook to our server
app.post('/webhook', botWebhook)

//setup webhook manually
//run ngrok http 3000
//copy url from ngrok and paste to WEBHOOK_URL in .env file
//run npm run dev
app.get('/setup-webhook', async (req, res) => {
  try {
    const url = `${config.WEBHOOK_URL}/webhook`;
    await bot.api.setWebhook(url);
    res.send(`Webhook successfully set to: ${url}`);
  } catch (error) {
    console.error("Error setting up webhook:", error);
    res.status(500).send("Error setting up webhook.");
  }
});

app.listen(config.PORT, () => {
  console.log(`🤖 Milk Tea Bot is running on port ${config.PORT}`);
});