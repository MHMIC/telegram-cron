import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WordPressPost } from '../../src/wordpress';

vi.mock('../../src/wordpress', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/wordpress')>();
	return { ...actual, getLatestPost: vi.fn() };
});

vi.mock('../../src/telegram', () => ({
	sendTelegramAudio: vi.fn(),
	sendErrorNotification: vi.fn(),
}));

vi.mock('../../src/audio', () => ({
	getHTML: vi.fn(async () => '<html></html>'),
	getAudioUrl: vi.fn(() => 'https://files.mhmic.org/a-reminder.mp3'),
}));

vi.mock('../../src/storage', () => ({
	getLastSentAt: vi.fn(),
	setLastSentAt: vi.fn(),
}));

import { scheduledHandler, fetchHandler } from '../../src/handlers';
import { getLatestPost, getPublishedAt } from '../../src/wordpress';
import { sendTelegramAudio, sendErrorNotification } from '../../src/telegram';
import { getLastSentAt, setLastSentAt } from '../../src/storage';

const buildPost = (dateGmt: string, slug = 'a-reminder'): WordPressPost => ({
	id: 1,
	slug,
	title: { rendered: 'A Reminder' },
	content: { rendered: '<p>body</p>' },
	date: dateGmt,
	date_gmt: dateGmt,
	modified: dateGmt,
	link: `https://mhmic.org/fajrreminders/${slug}`,
	categories: [2],
});

const OLDER = buildPost('2025-01-09T12:00:00');
const NEWER = buildPost('2025-01-10T12:00:00', 'a-newer-reminder');

const cronEvent = { cron: '*/10 * * * *' } as ScheduledController;

const triggerRequest = (init: RequestInit & { secret?: string | null } = {}) => {
	const { secret = 'test-trigger-secret', ...rest } = init;
	return new Request('https://worker.example/', {
		method: 'POST',
		headers: secret === null ? {} : { authorization: `Bearer ${secret}` },
		...rest,
	});
};

beforeEach(() => {
	vi.mocked(getLatestPost).mockReset().mockResolvedValue(NEWER);
	vi.mocked(getLastSentAt).mockReset().mockResolvedValue(getPublishedAt(OLDER));
	vi.mocked(setLastSentAt).mockReset().mockResolvedValue();
	vi.mocked(sendTelegramAudio).mockReset().mockResolvedValue();
	vi.mocked(sendErrorNotification).mockReset().mockResolvedValue();
});

describe('scheduledHandler', () => {
	it('should send when the latest post is newer than the last one sent', async () => {
		await scheduledHandler(cronEvent);

		expect(sendTelegramAudio).toHaveBeenCalledOnce();
		expect(setLastSentAt).toHaveBeenCalledWith('fr', getPublishedAt(NEWER));
	});

	it('should not send when the latest post has already been sent', async () => {
		vi.mocked(getLatestPost).mockResolvedValue(OLDER);

		await scheduledHandler(cronEvent);

		expect(sendTelegramAudio).not.toHaveBeenCalled();
		expect(setLastSentAt).not.toHaveBeenCalled();
	});

	it('should not send when the newest post was deleted and an older one is now latest', async () => {
		vi.mocked(getLastSentAt).mockResolvedValue(getPublishedAt(NEWER));
		vi.mocked(getLatestPost).mockResolvedValue(OLDER);

		await scheduledHandler(cronEvent);

		expect(sendTelegramAudio).not.toHaveBeenCalled();
	});

	it('should seed the timestamp without sending on the first run', async () => {
		vi.mocked(getLastSentAt).mockResolvedValue(null);

		await scheduledHandler(cronEvent);

		expect(sendTelegramAudio).not.toHaveBeenCalled();
		expect(setLastSentAt).toHaveBeenCalledWith('fr', getPublishedAt(NEWER));
	});

	it('should not send when the stored timestamp cannot be read', async () => {
		vi.mocked(getLastSentAt).mockRejectedValue(new Error('KV unavailable'));

		await expect(scheduledHandler(cronEvent)).rejects.toThrow(/KV unavailable/);

		expect(sendTelegramAudio).not.toHaveBeenCalled();
		expect(setLastSentAt).not.toHaveBeenCalled();
		expect(sendErrorNotification).toHaveBeenCalledOnce();
	});

	it('should leave the timestamp untouched when the send fails', async () => {
		vi.mocked(sendTelegramAudio).mockRejectedValue(new Error('Telegram sendAudio failed: 400 - Bad Request'));

		await expect(scheduledHandler(cronEvent)).rejects.toThrow(/Telegram sendAudio failed/);

		expect(setLastSentAt).not.toHaveBeenCalled();
	});

	it('should report a failure exactly once', async () => {
		vi.mocked(sendTelegramAudio).mockRejectedValue(new Error('boom'));

		await expect(scheduledHandler(cronEvent)).rejects.toThrow(/boom/);

		expect(sendErrorNotification).toHaveBeenCalledOnce();
	});
});

describe('fetchHandler', () => {
	it('should reject a request with no credentials', async () => {
		const response = await fetchHandler(triggerRequest({ secret: null }));

		expect(response.status).toBe(401);
		expect(sendTelegramAudio).not.toHaveBeenCalled();
	});

	it('should reject a request with the wrong secret', async () => {
		const response = await fetchHandler(triggerRequest({ secret: 'wrong-secret-value' }));

		expect(response.status).toBe(401);
		expect(sendTelegramAudio).not.toHaveBeenCalled();
	});

	it('should reject a GET even with the correct secret', async () => {
		const response = await fetchHandler(triggerRequest({ method: 'GET' }));

		expect(response.status).toBe(405);
		expect(sendTelegramAudio).not.toHaveBeenCalled();
	});

	it('should send and record the timestamp when authorized', async () => {
		const response = await fetchHandler(triggerRequest());

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ message: 'Sent', slug: NEWER.slug });
		expect(sendTelegramAudio).toHaveBeenCalledOnce();
		expect(setLastSentAt).toHaveBeenCalledWith('fr', getPublishedAt(NEWER));
	});

	it('should return 500 and notify when the send fails', async () => {
		vi.mocked(sendTelegramAudio).mockRejectedValue(new Error('boom'));

		const response = await fetchHandler(triggerRequest());

		expect(response.status).toBe(500);
		expect(sendErrorNotification).toHaveBeenCalledOnce();
		expect(setLastSentAt).not.toHaveBeenCalled();
	});
});
