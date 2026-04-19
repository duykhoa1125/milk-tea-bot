Chạy **ngrok cho webhook** là cách phổ biến để expose server local (localhost) ra internet, giúp các service như Telegram bot, Stripe, GitHub webhook… gọi được về máy bạn.

Mình hướng dẫn theo flow chuẩn + dễ hiểu nhất 👇

---

## 1. Cài ngrok

* Tải tại: [https://ngrok.com/download](https://ngrok.com/download)
* Giải nén → đặt vào PATH (hoặc chạy trực tiếp file)

Kiểm tra:

```bash
ngrok version
```

---

## 2. Đăng nhập (lần đầu)

Lấy **auth token** trên dashboard ngrok:

```bash
ngrok config add-authtoken YOUR_TOKEN
```

---

## 3. Chạy server local của bạn

Ví dụ:

```bash
npm run dev
```

Giả sử server chạy ở:

```
http://localhost:3000
```

---

## 4. Mở tunnel bằng ngrok

```bash
ngrok http 3000
```

Kết quả sẽ kiểu như:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

👉 Đây là URL public bạn dùng cho webhook:

```
https://abc123.ngrok-free.app
```

---

## 5. Gắn webhook vào service

### Ví dụ với Telegram bot (grammy)

```bash
https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://abc123.ngrok-free.app/webhook
```

### Ví dụ Express server:

```js
app.post("/webhook", (req, res) => {
    console.log(req.body);
    res.sendStatus(200);
});
```

👉 Webhook URL sẽ là:

```
https://abc123.ngrok-free.app/webhook
```

---

## 6. Debug realtime

* Mở dashboard:

```
http://127.0.0.1:4040
```

👉 Xem request webhook gửi về → cực kỳ hữu ích khi debug

---

## 7. Lưu ý quan trọng (hay bị dính)

* ❌ URL ngrok **thay đổi mỗi lần restart**
* 👉 Nếu dùng webhook → phải set lại URL mỗi lần chạy ngrok
* 👉 Hoặc dùng **ngrok paid** để có domain cố định

---

## 8. Flow tổng thể (hiểu bản chất)

```
Client (Telegram, Stripe,...)
        ↓
ngrok public URL (https)
        ↓
ngrok tunnel
        ↓
localhost:3000
        ↓
server của bạn
```

---

## 9. Tip xịn (dev chuyên nghiệp hay dùng)

* Dùng với:

  * Telegram bot (grammy)
  * Stripe webhook test
  * GitHub webhook CI/CD
* Có thể combine với:

  * Docker
  * Cloudflare tunnel (free domain cố định)

---

Nếu bạn đang làm **bot trà sữa dùng webhook + Redis + grammy**, mình có thể setup luôn cho bạn 1 flow hoàn chỉnh (code + webhook + deploy giả lập production) 👍
