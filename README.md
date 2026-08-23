# MHMIC Telegram Cron

A Cloudflare Worker that watches the [Fajr Reminders](https://mhmic.org/fajrreminders)
category on mhmic.org and posts each new reminder's audio to a Telegram chat.

## How it works

A cron trigger runs every 10 minutes. Each run fetches the latest post in the
category and compares its publish time against the last one sent, which is kept
in KV under `fr:last-sent-at`. When the post is newer, the worker scrapes the
audio URL from the post page, downloads it, reads its metadata (title, duration,
performer) and uploads it to the chat via the Telegram Bot API. The KV timestamp
is written only after the upload succeeds, so a failed send is retried on the
next tick instead of being silently skipped.

On the very first run against an empty KV namespace the worker records the
current position without sending, so deploying does not re-post a reminder that
has already gone out.

## Configuration

All four values are Cloudflare secrets — there is no `.env` file in production.
See `.env.example` for the list.

```
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put MAIN_CHAT_ID
npx wrangler secret put NOTIFICATIONS_CHAT_ID
npx wrangler secret put TRIGGER_SECRET
```

| Secret                  | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`    | Bot token from BotFather                                                  |
| `MAIN_CHAT_ID`          | Chat that receives the audio                                              |
| `NOTIFICATIONS_CHAT_ID` | Chat that receives error alerts (optional; alerts are skipped when unset) |
| `TRIGGER_SECRET`        | Shared token required by the manual HTTP trigger                          |

To find a chat ID: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`

For local development, put the same keys in a `.dev.vars` file (git-ignored).

## Development

```
npm install
npm run dev      # local worker with scheduled events enabled
npm test         # unit tests (vitest, workers pool)
npm run typecheck
npm run deploy
```

`npm run dev` prints the local port; it is usually 8787.

## Manual trigger

The HTTP entrypoint sends the latest reminder on demand. It requires a `POST`
and the shared secret — an unauthenticated request would let anyone post to the
chat and pull a full audio download through the worker.

```
curl -X POST http://localhost:8787/ \
  -H "Authorization: Bearer ${TRIGGER_SECRET}"
```

Responses: `200` on success, `401` for a bad or missing token, `405` for a
non-`POST` request, `503` when `TRIGGER_SECRET` is not configured, `500` when the
send itself fails.
