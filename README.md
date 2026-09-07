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

Once the audio is on Telegram the same reminder is emailed to the addresses in
`EMAIL_TO` through Cloudflare Email Routing. The email links to the post and the
audio file rather than attaching it, which keeps the message well inside Email
Routing's size limit. Email is best effort: the audio has already gone out by
then, so a failed email is reported to the notifications chat and the run still
succeeds rather than re-posting the audio on the next tick.

On the very first run against an empty KV namespace the worker records the
current position without sending, so deploying does not re-post a reminder that
has already gone out.

## Configuration

All values are Cloudflare secrets — there is no `.env` file in production.
The names are declared under `secrets.required` in `wrangler.jsonc`, which is
what `wrangler types` generates their bindings from, so adding a secret means
adding it there as well. See `.env.example` for the list.

```
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put MAIN_CHAT_ID
npx wrangler secret put NOTIFICATIONS_CHAT_ID
npx wrangler secret put TRIGGER_SECRET
npx wrangler secret put EMAIL_FROM
npx wrangler secret put EMAIL_TO
```

| Secret                  | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`    | Bot token from BotFather                                                   |
| `MAIN_CHAT_ID`          | Chat that receives the audio                                               |
| `NOTIFICATIONS_CHAT_ID` | Chat that receives error alerts (optional; alerts are skipped when unset)  |
| `TRIGGER_SECRET`        | Shared token required by the manual HTTP trigger                           |
| `EMAIL_FROM`            | Sender address for reminder emails (optional; email is skipped when unset) |
| `EMAIL_TO`              | Comma separated recipients (optional; email is skipped when unset)         |

To find a chat ID: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`

For local development, put the same keys in a `.dev.vars` file (git-ignored).

### Email notifications

Email goes out through the `SEND_EMAIL` binding in `wrangler.jsonc`, using
Cloudflare Email Service. `EMAIL_FROM` must be an address on a domain in the
Cloudflare account; `EMAIL_TO` is a comma separated list, so notifying two
mailing lists is just two addresses.

Which recipients are reachable depends on how the sending domain is set up:

- **Verified destinations only** (free, Email Routing alone). Every address in
  `EMAIL_TO` must first be added and verified under Email Routing → Destination
  Addresses. Cloudflare emails a verification link to the address, so somebody
  receiving mail at it has to click through.
- **Onboarded sending domain** (Email Sending, currently Beta and on the Workers
  Paid plan). Once the domain is onboarded under Email Service → Email Sending,
  the worker can send to any recipient with no per-address verification, and
  Cloudflare adds SPF, DKIM and DMARC records so the mail authenticates
  properly.

Onboarding adds MX records on the `cf-bounce` subdomain rather than the apex, so
it does not take over inbound mail for a domain already served by another
provider. It does add a DMARC record at `_dmarc.yourdomain.com` — review that
step if the domain already publishes one.

A rejected recipient fails only that one address; the rest are still attempted,
and the failure is reported to `NOTIFICATIONS_CHAT_ID` with addresses masked to
their domain — the full detail stays in the Workers logs.

Messages carry `Auto-Submitted: auto-generated` so that a recipient's
out-of-office does not reply back to a list.

#### Sending to a Google Group

Two things on the Google side decide whether the mail lands:

1. **Posting permission.** A group's _Who can post_ setting commonly defaults to
   members only, which rejects an outside sender. Either allow posting from
   outside the organisation, or add `EMAIL_FROM` to the group as a member with
   posting rights.
2. **Authentication.** A group re-distributes each message to every member's
   inbox, so unauthenticated mail is much more likely to be junked than it would
   be for a single recipient. Onboarding the sending domain (above) is what
   provides the SPF and DKIM records that avoid this.

Locally, `wrangler dev` does not deliver mail — it logs the message and writes
the bodies to temporary files instead.

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
