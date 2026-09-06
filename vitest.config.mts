import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: {
				configPath: './wrangler.jsonc',
			},
			miniflare: {
				// Stand-ins for the production secrets so modules that read
				// `env` at import time can be loaded under test.
				bindings: {
					TELEGRAM_BOT_TOKEN: 'test-bot-token',
					MAIN_CHAT_ID: 'test-main-chat',
					NOTIFICATIONS_CHAT_ID: 'test-notifications-chat',
					TRIGGER_SECRET: 'test-trigger-secret',
				},
			},
		}),
	],
});
