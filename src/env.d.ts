/**
 * Secrets, declared separately from `worker-configuration.d.ts`.
 *
 * `wrangler types` regenerates that file from `wrangler.jsonc` alone, so
 * anything added to it by hand is lost on the next run. Secrets are not in
 * `wrangler.jsonc` — they are set with `wrangler secret put` — so they are
 * merged into the generated interfaces from here instead.
 */
interface WorkerSecrets {
	TELEGRAM_BOT_TOKEN: string;
	MAIN_CHAT_ID: string;
	NOTIFICATIONS_CHAT_ID: string;
	TRIGGER_SECRET: string;
	EMAIL_FROM: string;
	EMAIL_TO: string;
}

declare namespace Cloudflare {
	interface Env extends WorkerSecrets {}
}

interface Env extends WorkerSecrets {}
