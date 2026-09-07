import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendTelegramAudio } from '../../src/telegram';
import type { Enclosure } from '../../src/feed';

const enclosure = (overrides: Partial<Enclosure> = {}): Enclosure => ({
	url: 'https://media.blubrry.com/x/a-reminder.mp3',
	length: 8_600_000,
	declaredType: 'audio/mpeg',
	...overrides,
});

const stubFetch = (impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) => {
	const mock = vi.fn(impl);
	vi.stubGlobal('fetch', mock);
	return mock;
};

const okTelegram = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {});
	// The buffer path feeds fake bytes to music-metadata, which logs the parse
	// failure it then recovers from.
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('sendTelegramAudio', () => {
	it('should hand Telegram the URL without downloading when the file is at or below 20 MB', async () => {
		const fetchMock = stubFetch(async () => okTelegram());

		await sendTelegramAudio(enclosure({ length: 20 * 1024 * 1024 }));

		expect(fetchMock).toHaveBeenCalledOnce();

		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toMatch(/\/sendAudio$/);
		expect(JSON.parse(String(init?.body))).toMatchObject({
			audio: 'https://media.blubrry.com/x/a-reminder.mp3',
			title: 'a reminder',
		});
	});

	it('should reject audio over 50 MB before fetching anything', async () => {
		const fetchMock = stubFetch(async () => okTelegram());

		// The 104 MB WAV that exhausted the isolate is what this guard is for.
		await expect(sendTelegramAudio(enclosure({ length: 104_311_162, url: 'https://media.blubrry.com/x/Emaan.wav' }))).rejects.toThrow(
			/too large to send/
		);

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should buffer and upload when the feed omits the length', async () => {
		const fetchMock = stubFetch(async (input) =>
			String(input).startsWith('https://api.telegram.org') ? okTelegram() : new Response(new Uint8Array([1, 2, 3]), { status: 200 })
		);

		await sendTelegramAudio(enclosure({ length: 0 }));

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(String(fetchMock.mock.calls[0][0])).toBe('https://media.blubrry.com/x/a-reminder.mp3');

		const body = fetchMock.mock.calls[1][1]?.body as FormData;
		expect(body).toBeInstanceOf(FormData);
		expect(body.get('title')).toBe('a reminder');
		expect((body.get('audio') as File).name).toBe('a-reminder.mp3');
	});

	it('should buffer and upload between 20 and 50 MB', async () => {
		const fetchMock = stubFetch(async (input) =>
			String(input).startsWith('https://api.telegram.org') ? okTelegram() : new Response(new Uint8Array([1, 2, 3]), { status: 200 })
		);

		await sendTelegramAudio(enclosure({ length: 30 * 1024 * 1024 }));

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData);
	});

	it('should reject on the buffer path when content-length exceeds the limit', async () => {
		// The feed under-reported the size, so the guard has to fire on the
		// response headers instead.
		stubFetch(async (input) =>
			String(input).startsWith('https://api.telegram.org')
				? okTelegram()
				: new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-length': String(60 * 1024 * 1024) } })
		);

		await expect(sendTelegramAudio(enclosure({ length: 0 }))).rejects.toThrow(/too large to send/);
	});

	it('should throw when the audio download fails', async () => {
		stubFetch(async (input) =>
			String(input).startsWith('https://api.telegram.org') ? okTelegram() : new Response('nope', { status: 404, statusText: 'Not Found' })
		);

		await expect(sendTelegramAudio(enclosure({ length: 0 }))).rejects.toThrow(/Failed to download audio: 404/);
	});

	it('should surface the Telegram error description on the URL path', async () => {
		stubFetch(async () => new Response(JSON.stringify({ description: 'wrong file identifier' }), { status: 400 }));

		await expect(sendTelegramAudio(enclosure())).rejects.toThrow(/sendAudio \(by URL\) failed: 400 - wrong file identifier/);
	});

	it('should reject a non-http URL before doing any work', async () => {
		const fetchMock = stubFetch(async () => okTelegram());

		await expect(sendTelegramAudio(enclosure({ url: 'ftp://media.blubrry.com/x/a.mp3' }))).rejects.toThrow(/Invalid audio URL/);

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
