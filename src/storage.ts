import { env } from 'cloudflare:workers';

export type StorageCategory = 'fr' | 'jk';

const lastSentKey = (category: StorageCategory) => `${category}:last-sent-at`;

/**
 * Returns the publish time (epoch ms) of the most recently sent post, or null
 * when nothing has been recorded for the category yet.
 *
 * Read failures propagate instead of defaulting to 0. A transient KV error must
 * not look like "nothing has ever been sent", which would re-send the latest
 * audio on every cron tick until KV recovered.
 */
export const getLastSentAt = async (category: StorageCategory): Promise<number | null> => {
	const key = lastSentKey(category);
	console.log(`Fetching last sent timestamp from KV for category: ${category}`);

	const stored = await env.MHMIC_TELEGRAM_BOT.get(key);

	if (stored === null) {
		console.log(`No last sent timestamp found for ${category}`);
		return null;
	}

	const lastSentAt = Number.parseInt(stored, 10);

	if (Number.isNaN(lastSentAt)) {
		throw new Error(`Corrupt value in KV for ${key}: "${stored}"`);
	}

	console.log(`Last sent timestamp for ${category}: ${lastSentAt}`);
	return lastSentAt;
};

/**
 * Records the publish time (epoch ms) of the post that was just sent.
 */
export const setLastSentAt = async (category: StorageCategory, publishedAt: number): Promise<void> => {
	console.log(`Updating last sent timestamp for ${category} to: ${publishedAt}`);
	await env.MHMIC_TELEGRAM_BOT.put(lastSentKey(category), publishedAt.toString());
	console.log(`Successfully updated last sent timestamp for ${category}`);
};
