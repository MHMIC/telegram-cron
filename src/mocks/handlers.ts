import { http, HttpResponse } from 'msw';

const WEBSITE = 'https://mhmic.org';
const API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/posts`;
const CATEGORY_API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/categories`;
const MOCK_BOT_TOKEN = '123456:ABC-DEF1234567890';

export const handlers = [
	http.get(API_ENDPOINT, () => {
		return HttpResponse.json([
			{
				slug: 'test-slug',
			},
		]);
	}),
	http.get(`${CATEGORY_API_ENDPOINT}/2`, () => {
		return HttpResponse.json({
			count: 1,
		});
	}),
	http.get(`${WEBSITE}/fajrreminders/test-slug`, () => {
		return new HttpResponse(
			'<html><body><audio><source src="https://example.com/audio.mp3/test" /></audio></body></html>'
		);
	}),
	http.post(`https://api.telegram.org/bot${MOCK_BOT_TOKEN}/sendMessage`, () => {
		return HttpResponse.json({ ok: true });
	}),
	http.post(`https://api.telegram.org/bot${MOCK_BOT_TOKEN}/sendAudio`, () => {
		return HttpResponse.json({ ok: true });
	}),
];
