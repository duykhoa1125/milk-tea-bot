import app from "./app";
import { config } from "./config/env";

app.listen(config.PORT, () => {
  console.log(`🤖 Milk Tea Bot is running on port ${config.PORT}`);
});
