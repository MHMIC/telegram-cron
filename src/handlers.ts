import { env } from 'cloudflare:workers';
import { getLatestPost, getPublishedAt, WordPressPost } from './wordpress';
import { sendTelegramAudio, sendErrorNotification } from './telegram';
import { getHTML, getAudioUrl } from './audio';
import { getLastSentAt, setLastSentAt } from './storage';
import { secretsMatch } from './utils';

const CATEGORY = 'FR';
const STORAGE_CATEGORY = 'fr';

const jsonResponse = (body: Record<string, unknown>, status: number) =>
	Response.json({ ...body, timestamp: new Date().toISOString() }, { status });

const describeError = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

/**
 * Sends the audio attached to a post. Errors propagate to the caller, which owns
 * error notification, so a single failure is only reported once.
 */
export const send = async (post: WordPressPost) => {
	console.log(`Starting send operation for post: ${post.slug}`);

	const html = await getHTML(post.slug);
	const audioSrc = getAudioUrl(html);

	await sendTelegramAudio(audioSrc);

	console.log('Send operation completed successfully');
};

export const scheduledHandler = async (event: ScheduledController): Promise<void> => {
	try {
		console.log(`CRON triggered at ${event.cron}`);

		const post = await getLatestPost(CATEGORY);
		const publishedAt = getPublishedAt(post);
		const lastSentAt = await getLastSentAt(STORAGE_CATEGORY);

		if (lastSentAt === null) {
			// First run against an empty namespace. Record the current position
			// rather than sending a reminder that has almost certainly gone out
			// already.
			await setLastSentAt(STORAGE_CATEGORY, publishedAt);
			console.log(`CRON fired at ${event.cron}: seeded last sent timestamp with ${post.slug} (${publishedAt})`);
			return;
		}

		// Comparing publish times rather than post counts means a deleted post
		// cannot make an older reminder look new.
		if (publishedAt <= lastSentAt) {
			console.log(`CRON fired at ${event.cron}: no new content (latest is ${post.slug})`);
			return;
		}

		await send(post);

		// Recorded only after a successful send, so a failed send is retried on
		// the next tick instead of being marked as delivered.
		await setLastSentAt(STORAGE_CATEGORY, publishedAt);

		console.log(`CRON fired at ${event.cron}: sent ${post.slug}`);
	} catch (error) {
		const errorMessage = `Error in scheduled handler: ${describeError(error)}`;
		console.error(errorMessage);
		await sendErrorNotification(errorMessage);
		throw error;
	}
};

/**
 * Manual trigger. Guarded by a shared secret because an unauthenticated request
 * would let anyone post to the chat and pull a full audio download through the
 * worker.
 */
export const fetchHandler = async (request: Request): Promise<Response> => {
	if (request.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	if (!env.TRIGGER_SECRET) {
		console.error('TRIGGER_SECRET is not configured, refusing manual trigger');
		return jsonResponse({ error: 'Manual trigger is not configured' }, 503);
	}

	const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

	if (!secretsMatch(provided, env.TRIGGER_SECRET)) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	try {
		const post = await getLatestPost(CATEGORY);
		const publishedAt = getPublishedAt(post);

		await send(post);
		await setLastSentAt(STORAGE_CATEGORY, publishedAt);

		return jsonResponse({ message: 'Sent', slug: post.slug }, 200);
	} catch (error) {
		const errorMessage = `Error in fetch handler: ${describeError(error)}`;
		console.error(errorMessage);
		await sendErrorNotification(errorMessage);

		return jsonResponse({ error: 'Failed to process request', message: describeError(error) }, 500);
	}
};
