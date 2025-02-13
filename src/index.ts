/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { load } from 'cheerio';
import { cleanMp3Filename } from './utils';

const WEBSITE = 'https://mhmic.org';
const API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/posts`;
const CATEGORY_API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/categories`;
const FR_LINK = `${WEBSITE}/fajrreminders`;

const categoryIds = {
	fr: '2',
	jk: '3',
};

const getLatestPost = async (category: 'fr' | 'jk') => {
	let endpoint = API_ENDPOINT;
	if (category === 'fr') {
		endpoint = `${API_ENDPOINT}/?per_page=1&categories=2`;
	} else {
		endpoint = `${API_ENDPOINT}/?per_page=1&categories=3`;
	}

	const data = await fetch(endpoint);
	const posts: any[] = await data.json();
	const post = posts[0];

	return post;
};

const getCountFromWordpress = async (category: 'fr' | 'jk') => {
	const data = await fetch(`${CATEGORY_API_ENDPOINT}/${categoryIds[category]}`);
	const categoryInfo: any = await data.json();

	return categoryInfo.count as number;
};

const getCountFromKV = async (category: 'fr' | 'jk', env: Env) => {
	try {
		const countStr = await env.MHMIC_TELEGRAM_BOT.get(category);

		if (countStr === null) {
			await env.MHMIC_TELEGRAM_BOT.put(category, '0');
			return parseInt('0');
		}

		const count = parseInt(countStr);

		return count;
	} catch (e: any) {
		return parseInt('0');
	}
};

const updateKVCount = async (category: 'fr' | 'jk', count: number, env: Env) => {
	try {
		await env.MHMIC_TELEGRAM_BOT.put(category, count.toString());
		return new Response(`count: ${count}`, { status: 200 });
	} catch (e: any) {
		return new Response(e.message, { status: 500 });
	}
};

const getHTML = async (slug: string) => {
	const data = await fetch(`${FR_LINK}/${slug}`);
	const html = await data.text();
	return html;
};

const getAudioUrl = (html: string) => {
	const $ = load(html);
	const audioSrc = $('audio source').attr('src');
	return audioSrc;
};

const sendTelegramMessage = async (text: string, env: Env) => {
	const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
	const CHAT_ID = env.CHAT_ID;

	try {
		console.log(`sending.. to:`, CHAT_ID);
		const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				chat_id: CHAT_ID,
				text: text,
			}),
		});
		console.log(await response.text());
	} catch (error) {
		console.log(error);
	}
};

const sendTelegramAudio = async (audioUrl: string, env: Env) => {
	const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
	const CHAT_ID = env.CHAT_ID;

	// Fetch the audio file as a blob
	const audioResponse = await fetch(audioUrl);
	const audioBlob = await audioResponse.blob();
	console.log('audioUrl', audioUrl);
	const audioName = cleanMp3Filename(audioUrl);
	console.log('audioName', audioName);

	// Prepare form data to send the audio file
	const formData = new FormData();
	formData.append('chat_id', CHAT_ID);
	formData.append('audio', audioBlob, audioName); // audioUrl is like 'audio.mp3' which is the filename

	try {
		// Send the audio file to Telegram
		console.log(`sending.. to:`, CHAT_ID);
		const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, {
			method: 'POST',
			body: formData,
		});
		console.log(await telegramResponse.text());
	} catch (error) {
		console.log(error);
	}
};

const send = async (env: Env) => {
	const post = await getLatestPost('fr');
	const html = await getHTML(post.slug);
	const audioSrc = getAudioUrl(html);

	if (audioSrc) {
		await sendTelegramAudio(audioSrc, env);
	}
};

export default {
	// The scheduled handler is invoked at the interval set in our wrangler.toml's
	// [[triggers]] configuration.
	async scheduled(event, env): Promise<void> {
		let wasSuccessful = 'NA';
		const wordpressCount = await getCountFromWordpress('fr');
		const kvCount = await getCountFromKV('fr', env);

		if (wordpressCount > kvCount) {
			await send(env);

			const resp = await updateKVCount('fr', wordpressCount, env);
			wasSuccessful = resp.ok ? 'success' : 'fail';

			console.log(`CRON Fired and message sent ${event.cron}`);
		} else {
			console.log(`CRON Fired and message was NOT sent ${event.cron}`);
		}
		console.log(`trigger fired at ${event.cron}: ${wasSuccessful}`);
	},
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const text = url.searchParams.get('text');
		await sendTelegramMessage(text || 'Force send the latest post', env);
		await send(env);

		return Response.json({
			message: 'Sent',
		});
	},
} satisfies ExportedHandler<Env>;
