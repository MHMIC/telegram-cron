import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
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
			},
		},
	},
});
