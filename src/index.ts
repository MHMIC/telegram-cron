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

import { Telegraf } from 'telegraf';
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
	const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
	try {
		console.log(`sending.. to:`, env.CHAT_ID);
		await bot.telegram.sendMessage(env.CHAT_ID, text);
		console.log('Message sent successfully');
	} catch (error) {
		console.log(error);
	}
};

const sendTelegramAudio = async (audioUrl: string, env: Env) => {
	const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
	try {
		console.log(`sending.. to:`, env.CHAT_ID);
		await bot.telegram.sendAudio(env.CHAT_ID, audioUrl);
		console.log('Audio sent successfully');
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
