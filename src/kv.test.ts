import { describe, it, expect } from 'vitest';
import { getCountFromKV, updateKVCount } from './kv';

describe('kv', () => {
	it('getCountFromKV', async () => {
		const env = {
			MHMIC_TELEGRAM_BOT: {
				get: async () => '1',
				put: async () => {},
			},
		};
		const count = await getCountFromKV('fr', env as any);
		expect(count).toBe(1);
	});

	it('updateKVCount', async () => {
		const env = {
			MHMIC_TELEGRAM_BOT: {
				put: async () => {},
			},
		};
		await updateKVCount('fr', 1, env as any);
	});
});
