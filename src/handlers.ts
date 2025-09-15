import { getLatestPost, getCountFromWordpress } from './wordpress';
import { sendTelegramMessage, sendTelegramAudio, sendErrorNotification } from './telegram';
import { getHTML, getAudioUrl } from './audio';
import { getCountFromKV, updateKVCount } from './storage';

export const send = async (env: Env) => {
	try {
		console.log('Starting send operation');
		const post = await getLatestPost('fr');
		const html = await getHTML(post.slug);
		const audioSrc = getAudioUrl(html);

		if (audioSrc) {
			await sendTelegramAudio(audioSrc, env);
		} else {
			throw new Error('No audio source found');
		}
		
		console.log('Send operation completed successfully');
	} catch (error) {
		const errorMessage = `Error in send operation: ${error instanceof Error ? error.message : 'Unknown error'}`;
		console.error(errorMessage);
		await sendErrorNotification(errorMessage, env);
		throw error;
	}
};

export const scheduledHandler = async (event: any, env: Env): Promise<void> => {
	try {
		console.log(`CRON triggered at ${event.cron}`);
		let wasSuccessful = 'NA';
		
		const wordpressCount = await getCountFromWordpress('fr');
		const kvCount = await getCountFromKV('fr', env);

		console.log(`WordPress count: ${wordpressCount}, KV count: ${kvCount}`);

		if (wordpressCount > kvCount) {
			await send(env);

			const resp = await updateKVCount('fr', wordpressCount, env);
			wasSuccessful = resp.ok ? 'success' : 'fail';

			console.log(`CRON Fired and message sent ${event.cron}`);
		} else {
			console.log(`CRON Fired and message was NOT sent ${event.cron}`);
			wasSuccessful = 'no_new_content';
		}
		
		console.log(`Trigger fired at ${event.cron}: ${wasSuccessful}`);
	} catch (error) {
		const errorMessage = `Error in scheduled handler: ${error instanceof Error ? error.message : 'Unknown error'}`;
		console.error(errorMessage);
		await sendErrorNotification(errorMessage, env);
		throw error;
	}
};

export const fetchHandler = async (request: Request, env: Env, ctx: any) => {
	try {
		await send(env);
		return Response.json({
			message: 'Sent',
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		const errorMessage = `Error in fetch handler: ${error instanceof Error ? error.message : 'Unknown error'}`;
		console.error(errorMessage);
		await sendErrorNotification(errorMessage, env);
		
		return Response.json({
			error: 'Failed to process request',
			message: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
};
