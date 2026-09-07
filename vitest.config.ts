import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

// Stand-ins for the production secrets. `wrangler.jsonc` declares them under
// `secrets.required`, which is resolved from the environment, so setting them
// here supplies the bindings and satisfies the missing-secret check in one go —
// `.dev.vars` is git-ignored and therefore absent in CI.
//
// Assigned unconditionally: a real value exported in a developer's shell would
// otherwise leak into the run and fail the tests that assert on these.
const TEST_SECRETS = {
	TELEGRAM_BOT_TOKEN: 'test-bot-token',
	MAIN_CHAT_ID: 'test-main-chat',
	NOTIFICATIONS_CHAT_ID: 'test-notifications-chat',
	TRIGGER_SECRET: 'test-trigger-secret',
	EMAIL_FROM: 'reminders@mhmic.org',
	EMAIL_TO: 'subscriber@example.com',
};

for (const [name, value] of Object.entries(TEST_SECRETS)) {
	process.env[name] = value;
}

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: {
				configPath: './wrangler.jsonc',
			},
		}),
	],
});
