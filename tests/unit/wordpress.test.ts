import { describe, it, expect, vi, afterEach } from 'vitest';
import { getPublishedAt, getLatestPost, WordPressPost } from '../../src/wordpress';

const buildPost = (overrides: Partial<WordPressPost> = {}): WordPressPost => ({
	id: 1,
	slug: 'a-reminder',
	title: { rendered: 'A Reminder' },
	content: { rendered: '<p>body</p>' },
	date: '2025-01-09T07:00:00',
	date_gmt: '2025-01-09T12:00:00',
	modified: '2025-01-09T12:00:00',
	link: 'https://mhmic.org/fajrreminders/a-reminder',
	categories: [2],
	...overrides,
});

const mockFetch = (response: Response) => {
	const fetchMock = vi.fn(async (_input: RequestInfo | URL) => response);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('wordpress', () => {
	describe('getPublishedAt', () => {
		it('should read date_gmt as UTC even though WordPress omits the suffix', () => {
			expect(getPublishedAt({ date: '2025-01-09T07:00:00', date_gmt: '2025-01-09T12:00:00' })).toBe(Date.parse('2025-01-09T12:00:00Z'));
		});

		it('should not double up an existing UTC suffix', () => {
			expect(getPublishedAt({ date: '2025-01-09T07:00:00', date_gmt: '2025-01-09T12:00:00Z' })).toBe(Date.parse('2025-01-09T12:00:00Z'));
		});

		it('should fall back to date when date_gmt is missing', () => {
			expect(getPublishedAt({ date: '2025-01-09T07:00:00Z', date_gmt: '' })).toBe(Date.parse('2025-01-09T07:00:00Z'));
		});

		it('should throw on an unparseable date', () => {
			expect(() => getPublishedAt({ date: 'not-a-date', date_gmt: '' })).toThrow(/Unparseable post date/);
		});

		it('should order a newer post above an older one', () => {
			const older = getPublishedAt({ date: '', date_gmt: '2025-01-09T12:00:00' });
			const newer = getPublishedAt({ date: '', date_gmt: '2025-01-10T12:00:00' });

			expect(newer).toBeGreaterThan(older);
		});
	});

	describe('getLatestPost', () => {
		it('should return the first post of the category', async () => {
			const post = buildPost();
			const fetchMock = mockFetch(Response.json([post]));

			await expect(getLatestPost('FR')).resolves.toEqual(post);
			expect(fetchMock).toHaveBeenCalledOnce();
			expect(String(fetchMock.mock.calls[0][0])).toContain('categories=2');
		});

		it('should throw when the API responds with an error status', async () => {
			mockFetch(new Response('nope', { status: 500, statusText: 'Internal Server Error' }));

			await expect(getLatestPost('FR')).rejects.toThrow(/WordPress API error: 500/);
		});

		it('should throw when the category has no posts', async () => {
			mockFetch(Response.json([]));

			await expect(getLatestPost('FR')).rejects.toThrow(/No posts found for category: FR/);
		});
	});
});
