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

	try {
		console.log(`Fetching latest post for category: ${category} from ${endpoint}`);
		const data = await fetch(endpoint);
		
		if (!data.ok) {
			console.error(`Failed to fetch posts: ${data.status} ${data.statusText}`);
			throw new Error(`API request failed with status ${data.status}`);
		}

		const posts: any[] = await data.json();
		
		if (!posts || posts.length === 0) {
			console.error(`No posts found for category: ${category}`);
			throw new Error(`No posts found for category: ${category}`);
		}

		const post = posts[0];
		console.log(`Successfully fetched post: ${post.title?.rendered || post.id}`);
		return post;
	} catch (error) {
		console.error(`Error in getLatestPost for category ${category}:`, error);
		throw error;
	}
};

const getCountFromWordpress = async (category: 'fr' | 'jk') => {
	try {
		console.log(`Fetching count for category: ${category} from WordPress API`);
		const data = await fetch(`${CATEGORY_API_ENDPOINT}/${categoryIds[category]}`);
		
		if (!data.ok) {
			console.error(`Failed to fetch category count: ${data.status} ${data.statusText}`);
			throw new Error(`Category API request failed with status ${data.status}`);
		}

		const categoryInfo: any = await data.json();
		
		if (!categoryInfo || typeof categoryInfo.count !== 'number') {
			console.error(`Invalid category response for ${category}:`, categoryInfo);
			throw new Error(`Invalid category response: missing or invalid count`);
		}

		console.log(`Successfully fetched count for category ${category}: ${categoryInfo.count}`);
		return categoryInfo.count as number;
	} catch (error) {
		console.error(`Error in getCountFromWordpress for category ${category}:`, error);
		throw error;
	}
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
	try {
		console.log(`Fetching HTML for slug: ${slug}`);
		const data = await fetch(`${FR_LINK}/${slug}`);
		
		if (!data.ok) {
			console.error(`Failed to fetch HTML for slug ${slug}: ${data.status} ${data.statusText}`);
			throw new Error(`HTML fetch failed with status ${data.status}`);
		}

		const html = await data.text();
		
		if (!html || html.trim().length === 0) {
			console.error(`Empty HTML response for slug: ${slug}`);
			throw new Error(`Empty HTML response for slug: ${slug}`);
		}

		console.log(`Successfully fetched HTML for slug: ${slug} (${html.length} characters)`);
		return html;
	} catch (error) {
		console.error(`Error in getHTML for slug ${slug}:`, error);
		throw error;
	}
};

const getAudioUrl = (html: string) => {
	try {
		console.log(`Parsing HTML to extract audio URL`);
		const $ = load(html);
		const audioSrc = $('audio source').attr('src');
		
		if (!audioSrc) {
			console.error(`No audio source found in HTML`);
			throw new Error(`No audio source found in HTML`);
		}

		console.log(`Successfully extracted audio URL: ${audioSrc}`);
		return audioSrc;
	} catch (error) {
		console.error(`Error in getAudioUrl:`, error);
		throw error;
	}
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
	try {
		console.log(`Starting send process for latest FR post`);
		const post = await getLatestPost('fr');
		const html = await getHTML(post.slug);
		const audioSrc = getAudioUrl(html);

		if (audioSrc) {
			await sendTelegramAudio(audioSrc, env);
			console.log(`Successfully completed send process`);
		} else {
			console.error(`No audio source found, cannot send audio`);
			throw new Error(`No audio source found for post: ${post.slug}`);
		}
	} catch (error) {
		console.error(`Error in send function:`, error);
		throw error;
	}
};

export default {
	// The scheduled handler is invoked at the interval set in our wrangler.toml's
	// [[triggers]] configuration.
	async scheduled(event, env): Promise<void> {
		let wasSuccessful = 'NA';
		try {
			console.log(`CRON job started at ${event.cron}`);
			const wordpressCount = await getCountFromWordpress('fr');
			const kvCount = await getCountFromKV('fr', env);

			console.log(`WordPress count: ${wordpressCount}, KV count: ${kvCount}`);

			if (wordpressCount > kvCount) {
				await send(env);

				const resp = await updateKVCount('fr', wordpressCount, env);
				wasSuccessful = resp.ok ? 'success' : 'fail';

				if (wasSuccessful === 'success') {
					console.log(`CRON Fired and message sent successfully ${event.cron}`);
				} else {
					console.error(`CRON Fired but failed to update KV count ${event.cron}`);
				}
			} else {
				console.log(`CRON Fired but no new posts found ${event.cron}`);
			}
		} catch (error) {
			console.error(`CRON job failed at ${event.cron}:`, error);
			wasSuccessful = 'error';
		}
		console.log(`CRON trigger completed at ${event.cron}: ${wasSuccessful}`);
	},
	async fetch(request, env, ctx) {
		try {
			console.log(`Manual trigger received: ${request.url}`);
			const url = new URL(request.url);
			const text = url.searchParams.get('text');
			
			console.log(`Sending manual message: ${text || 'Force send the latest post'}`);
			await sendTelegramMessage(text || 'Force send the latest post', env);
			await send(env);

			console.log(`Manual trigger completed successfully`);
			return Response.json({
				message: 'Sent',
			});
		} catch (error) {
			console.error(`Manual trigger failed:`, error);
			return Response.json({
				message: 'Failed',
				error: error instanceof Error ? error.message : 'Unknown error',
			}, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
