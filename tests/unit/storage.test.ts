import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { getLastSentAt, setLastSentAt } from '../../src/storage';

const KEY = 'fr:last-sent-at';

beforeEach(async () => {
	await env.MHMIC_TELEGRAM_BOT.delete(KEY);
});

describe('storage', () => {
	it('should return null when nothing has been recorded yet', async () => {
		await expect(getLastSentAt('fr')).resolves.toBeNull();
	});

	it('should not write to KV while reading a missing key', async () => {
		await getLastSentAt('fr');

		await expect(env.MHMIC_TELEGRAM_BOT.get(KEY)).resolves.toBeNull();
	});

	it('should round-trip a timestamp', async () => {
		const publishedAt = Date.parse('2025-01-09T12:00:00Z');

		await setLastSentAt('fr', publishedAt);

		await expect(getLastSentAt('fr')).resolves.toBe(publishedAt);
	});

	it('should keep categories separate', async () => {
		await setLastSentAt('fr', 1000);

		await expect(getLastSentAt('jk')).resolves.toBeNull();
	});

	it('should throw rather than report a corrupt value as a timestamp', async () => {
		await env.MHMIC_TELEGRAM_BOT.put(KEY, 'not-a-number');

		await expect(getLastSentAt('fr')).rejects.toThrow(/Corrupt value in KV/);
	});

	it('should surface a read failure instead of defaulting to zero', async () => {
		const kv = env.MHMIC_TELEGRAM_BOT;
		const original = kv.get.bind(kv);
		kv.get = (async () => {
			throw new Error('KV unavailable');
		}) as typeof kv.get;

		try {
			await expect(getLastSentAt('fr')).rejects.toThrow(/KV unavailable/);
		} finally {
			kv.get = original;
		}
	});
});
