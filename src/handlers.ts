import { getLatestPost, getCountFromWordpress } from './wordpress';
import { sendTelegramMessage, sendTelegramAudio } from './telegram';
import { getHTML, getAudioUrl } from './audio';
import { getCountFromKV, updateKVCount } from './storage';
import { cleanMp3Filename } from './utils';

export const send = async (env: Env) => {
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

export const scheduledHandler = async (event: ScheduledController, env: Env): Promise<void> => {
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
};

export const fetchHandler = async (request: Request, env: Env, ctx: ExecutionContext) => {
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
};
