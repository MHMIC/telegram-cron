/**
 * MHMIC Telegram Cron Bot
 * 
 * A Cloudflare Worker that automatically sends new Fajr Reminder audio posts
 * from the MHMIC website to a Telegram chat when new content is available.
 * 
 * Features:
 * - Scheduled CRON job to check for new posts
 * - Manual trigger via HTTP fetch
 * - Error notifications to dedicated error chat
 * - Modular architecture for maintainability
 */

import { scheduledHandler, fetchHandler } from './handlers';

export default {
	// The scheduled handler is invoked at the interval set in our wrangler.toml's
	// [[triggers]] configuration.
	async scheduled(event, env): Promise<void> {
		await scheduledHandler(event, env);
	},
	async fetch(request, env, ctx) {
		return await fetchHandler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
