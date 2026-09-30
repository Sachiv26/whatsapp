# WhatsApp Cloud API (Node.js + TypeScript)

A minimal, production-ready service for **sending and receiving WhatsApp messages**
through the **Meta WhatsApp Business Cloud API** (Graph API `v21.0`).

Features:
- Send text, template, media and interactive button messages
- Receive inbound messages via webhook (verified handshake + async processing)
- Delivery / read status updates
- Automatic "mark as read" (blue ticks) on inbound messages
- Central axios instance with request/response logging and full Meta error reporting
- Typed configuration and payload interfaces — no hardcoded secrets

---

## Prerequisites

- Node.js 18+ (tested on Node 24)
- A Meta Business account with a WhatsApp Business number
- The **WhatsApp** product enabled on a Meta app (free tier is fine)
- [ngrok](https://ngrok.com/) or any public HTTPS tunnel for webhook testing

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
copy .env.example .env      # Windows PowerShell / cmd
# cp .env.example .env      # macOS / Linux

# 3. Fill in the values in .env (see below)

# 4. Run in development
npm run dev
```

### Environment variables

| Variable | Description |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Permanent access token from a System User |
| `WHATSAPP_PHONE_NUMBER_ID` | ID of the number you send from |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account (WABA) ID |
| `WEBHOOK_VERIFY_TOKEN` | Any random string you choose; must match Meta's dashboard value |
| `PORT` | Local server port (default `3000`) |
| `GRAPH_API_VERSION` | Graph API version (default `v21.0`) |

The app validates these at startup and exits with a clear error if any is missing.

---

## Finding your IDs in the Meta Developer Dashboard

1. Go to <https://developers.facebook.com/apps> → **My Apps** → your app.
2. Left sidebar → **WhatsApp** → **API Setup**.
3. On that page you will see:
   - **Phone number ID** → copy into `WHATSAPP_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID** → copy into `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - A temporary access token (valid 24h) — only useful for quick tests.

The same page is where you set the webhook (see below).

---

## Generating a permanent access token

The token shown in the dashboard expires in ~24 hours. For a permanent token:

1. Go to <https://business.facebook.com/settings> → **Business Settings** → **Users** → **System Users**.
2. Create a System User (e.g. `whatsapp-bot`) and assign it an admin asset
   (your app) with the `whatsapp_business_management` permission.
3. Generate a **System User Access Token**:
   - App → App Review → **Generate Access Token**
   - Select your app, tick **WhatsApp Business Management** (and `business_management` if needed).
   - The token shown **never expires** — store it in `.env`.
4. Alternatively use the Graph API:
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=client_credentials&client_id={APP_ID}&client_secret={APP_SECRET}"
   ```
5. Copy it into `WHATSAPP_ACCESS_TOKEN`. `.env` is gitignored — never commit it.

---

## Running

```bash
npm run dev     # tsx watch, auto-reloads on change
npm run build   # compile TypeScript to dist/
npm start       # run the compiled server
npm run test:send -- 27831234567 "Hello from CLI"
```

Server output shows the URL, health check, Graph API version and an ngrok reminder.

---

## Exposing the webhook with ngrok

Meta can only reach public HTTPS URLs, so `localhost` will not work.

```bash
# In a second terminal, keep it running
ngrok http 3000
```

ngrok prints something like `https://a1b2c3d4.ngrok.io`.

## Configuring the webhook in the Meta dashboard

1. <https://developers.facebook.com/apps> → your app → **WhatsApp** → **Configuration**.
2. **Webhook URL**: `https://a1b2c3d4.ngrok.io/webhook`
3. **Verify token**: the same string you put in `WEBHOOK_VERIFY_TOKEN` in `.env`
4. Click **Verify** — Meta sends a `GET` with `hub.mode`, `hub.verify_token` and
   `hub.challenge`; this app echoes `hub.challenge` back and returns `200`.
   You should see `[webhook] Verification request succeeded.` in your server log.
5. Click **Subscribe to the `messages` field** (required for webhook events).

Inbound messages are `POST`ed to the same URL. The server returns `200` immediately
(Meta requires a response within 5 seconds) and processes the payload asynchronously.
---

## API endpoints

### `GET /health`

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

### `POST /api/messages/text`

```bash
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -d '{"to":"27831234567","text":"Hello from curl"}'
```

Optional: `"previewUrl": true` renders a preview box for the first link.

### `POST /api/messages/template`

```bash
curl -X POST http://localhost:3000/api/messages/template \
  -H "Content-Type: application/json" \
  -d '{"to":"27831234567","templateName":"hello_world","languageCode":"en_US"}'
```

With variables:

```bash
curl -X POST http://localhost:3000/api/messages/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "27831234567",
    "templateName": "order_update",
    "languageCode": "en_US",
    "components": [
      { "type": "body", "parameters": [{ "type": "text", "text": "Bob" }] }
    ]
  }'
```

### `POST /api/messages/media`

```bash
curl -X POST http://localhost:3000/api/messages/media \
  -H "Content-Type: application/json" \
  -d '{
    "to": "27831234567",
    "type": "image",
    "link": "https://example.com/photo.jpg",
    "caption": "Our new menu"
  }'
```

Alternatively pass `"mediaId":"<MEDIA_ID>"` for media already uploaded via the Media API.

### `POST /api/messages/read`

```bash
curl -X POST http://localhost:3000/api/messages/read \
  -H "Content-Type: application/json" \
  -d '{"messageId":"wamid.HBgNNTUxMTk5OTk5OTk5ORUCABEYEjhFN0..."}'
```

### Success / error shape

```json
{ "success": true, "data": { "messaging_product": "whatsapp", "messages": [{ "id": "wamid.xxx" }] } }
```

```json
{ "success": false, "error": "(#131030) Recipient phone number not in allowed list" }
```

---

## Testing from the CLI

```bash
npm run test:send -- 27831234567 "Hello from CLI"
```

---

## Important Meta rules

**24-hour customer service window.** Once a user messages your business number, you
may reply with *any* free-form message for 24 hours. Outside that window Meta requires
an **approved message template**. Attempting a free-form message later returns error
`131047` / `131026` ("re-engagement message").

**Templates must be approved.** Create templates in **WhatsApp Manager → Message
templates**, wait for `APPROVED` status, then send them with
`POST /api/messages/template`. Variables use `{{1}}`, `{{2}}`, ...

**Conversation vs marketing templates.** Use the correct category —
utility templates for order updates, marketing templates require opt-in and cannot
be sent within the 24h window.

**Media hosting.** Links sent via `POST /messages` must be **publicly reachable over
HTTPS**. Meta downloads the file on demand; the link must support `HEAD` requests.
Files over 16 MB must use the Media API upload flow instead.

**Rate limits / pricing.** Meta charges per conversation (per-country rates). Sending
fails if the WhatsApp Business Account has no payment method or the limit is reached
(error `369`).

**Webhooks respond fast.** The route sends `200` before processing; keep your handler
under ~20 seconds or Meta will retry the event. For heavy work, enqueue a job.

**Development recipients.** While your app is in development, you can only message
numbers listed under **WhatsApp → API Setup → Recipients**. Production mode allows
anyone who has messaged your number.

**Error debugging.** Every Graph API failure is logged with Meta's `message`, `code`,
`error_subcode`, `error_data.details` and `fbtrace_id` — include the `fbtrace_id` when
contacting Meta support.

---

## Adding your own business logic

`src/handlers/messageHandler.ts` contains a marked `TODO` block. A typical flow:

```ts
if (message.type === 'text' && message.text?.body) {
  await whatsappService.sendTextMessage(message.from, `Echo: ${message.text.body}`);
}
```

It is commented out by default so you don't accidentally message real customers.
The recipient must be a number that has messaged your business number (or be added
to the allowed recipients list in **WhatsApp → API Setup** during development).

---

## Project structure

```
whatsapp-api/
├── src/
│   ├── index.ts                    # Express app, middleware, server start
│   ├── config/
│   │   └── env.ts                  # dotenv loading + validation
│   ├── services/
│   │   └── whatsapp.ts             # WhatsAppClient (axios, auth, logging, errors)
│   ├── routes/
│   │   ├── webhook.ts              # GET verification + POST events
│   │   └── messages.ts             # POST /api/messages/*
│   ├── handlers/
│   │   └── messageHandler.ts       # Inbound message / status processing
│   ├── scripts/
│   │   └── testSend.ts             # CLI send helper
│   └── types/
│       └── whatsapp.ts             # All payload interfaces
├── .env
├── .env.example
├── .gitignore
├── tsconfig.json
├── package.json
└── README.md
```