import { describe, it, expect } from 'vitest';
import { getLatestPost, getCountFromWordpress, getHTML, getAudioUrl } from './wordpress';

describe('wordpress', () => {
	it('getLatestPost', async () => {
		const post = await getLatestPost('fr');
		expect(post.slug).toBe('test-slug');
	});

	it('getCountFromWordpress', async () => {
		const count = await getCountFromWordpress('fr');
		expect(count).toBe(1);
	});

	it('getHTML', async () => {
		const html = await getHTML('test-slug');
		expect(html).toContain('<audio>');
	});

	it('getAudioUrl', () => {
		const html = '<html><body><audio><source src="https://example.com/audio.mp3/test" /></audio></body></html>';
		const audioUrl = getAudioUrl(html);
		expect(audioUrl).toBe('https://example.com/audio.mp3/test');
	});
});
