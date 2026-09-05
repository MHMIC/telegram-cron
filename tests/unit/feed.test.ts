import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEnclosure } from '../../src/feed';

const feed = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;

const item = (slug: string, url: string, length = '8600000', type = 'audio/mpeg') => `
	<item>
		<title>${slug}</title>
		<link>https://mhmic.org/fajrreminders/${slug}/</link>
		<guid isPermaLink="false">https://mhmic.org/?p=1&amp;slug=${slug}</guid>
		<enclosure url="${url}" length="${length}" type="${type}" />
	</item>`;

const respondWith = (body: string, init: ResponseInit = {}) =>
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(body, { status: 200, ...init }))
	);

beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('getEnclosure', () => {
	it('should return the enclosure for the item matching the slug', async () => {
		respondWith(
			feed(item('newest-one', 'https://media.blubrry.com/x/newest.mp3') + item('emaan-and-yaqeen', 'https://media.blubrry.com/x/emaan.mp3'))
		);

		const enclosure = await getEnclosure('FR', 'emaan-and-yaqeen');

		expect(enclosure.url).toBe('https://media.blubrry.com/x/emaan.mp3');
		expect(enclosure.length).toBe(8_600_000);
		expect(enclosure.declaredType).toBe('audio/mpeg');
	});

	it('should fall back to the newest item when the feed has not caught up with the slug', async () => {
		respondWith(feed(item('newest-one', 'https://media.blubrry.com/x/newest.mp3')));

		const enclosure = await getEnclosure('FR', 'not-in-the-feed-yet');

		expect(enclosure.url).toBe('https://media.blubrry.com/x/newest.mp3');
	});

	// The regression that started this: a wav episode still has an enclosure even
	// though the page renders no <audio> element for it.
	it('should resolve a wav enclosure and report its real size', async () => {
		respondWith(feed(item('emaan-and-yaqeen', 'https://media.blubrry.com/x/Emaan.wav', '104311162', 'audio/mpeg')));

		const enclosure = await getEnclosure('FR', 'emaan-and-yaqeen');

		expect(enclosure.url).toMatch(/\.wav$/);
		expect(enclosure.length).toBe(104_311_162);
	});

	it('should decode XML entities in the enclosure URL', async () => {
		respondWith(feed(item('slug', 'https://media.blubrry.com/x/a.mp3?one=1&amp;two=2')));

		const enclosure = await getEnclosure('FR', 'slug');

		expect(enclosure.url).toBe('https://media.blubrry.com/x/a.mp3?one=1&two=2');
	});

	it('should throw when the item has no enclosure', async () => {
		respondWith(feed('<item><title>No media</title><link>https://mhmic.org/fajrreminders/slug/</link></item>'));

		await expect(getEnclosure('FR', 'slug')).rejects.toThrow(/No audio enclosure/);
	});

	it('should throw when the feed has no items', async () => {
		respondWith(feed(''));

		await expect(getEnclosure('FR', 'slug')).rejects.toThrow(/no items/);
	});

	it('should throw when the feed request fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('nope', { status: 503, statusText: 'Service Unavailable' }))
		);

		await expect(getEnclosure('FR', 'slug')).rejects.toThrow(/Podcast feed error: 503/);
	});

	it('should throw for a category with no configured feed', async () => {
		await expect(getEnclosure('JK', 'slug')).rejects.toThrow(/No podcast feed configured/);
	});
});
