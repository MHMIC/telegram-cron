import { getLatestPost, getCountFromWordpress } from './wordpress';
import { sendTelegramAudio, sendErrorNotification } from './telegram';
import { getHTML, getAudioUrl } from './audio';
import { getCountFromKV, updateKVCount } from './storage';

export const send = async () => {
	try {
		console.log('Starting send operation');
		const post = await getLatestPost('FR');
		const html = await getHTML(post.slug);
		const audioSrc = getAudioUrl(html);

		if (audioSrc) {
			await sendTelegramAudio(audioSrc);
		} else {
			throw new Error('No audio source found');
		}

		console.log('Send operation completed successfully');
	} catch (error) {
		const errorMessage = `Error in send operation: ${error instanceof Error ? error.message : 'Unknown error'}`;
		console.error(errorMessage);
		await sendErrorNotification(errorMessage);
		throw error;
	}
};

export const scheduledHandler = async (event: ScheduledController): Promise<void> => {
	try {
		console.log(`CRON triggered at ${event.cron}`);
		let wasSuccessful = 'NA';

		const wordpressCount = await getCountFromWordpress('FR');
		const kvCount = await getCountFromKV('fr');

		console.log(`WordPress count: ${wordpressCount}, KV count: ${kvCount}`);

		if (wordpressCount > kvCount) {
			await send();

			const resp = await updateKVCount('fr', wordpressCount);
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
		await sendErrorNotification(errorMessage);
		throw error;
	}
};

export const fetchHandler = async (request: Request) => {
	try {
		await send();
		return Response.json({
			message: 'Sent',
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		const errorMessage = `Error in fetch handler: ${error instanceof Error ? error.message : 'Unknown error'}`;
		console.error(errorMessage);
		await sendErrorNotification(errorMessage);

		return Response.json(
			{
				error: 'Failed to process request',
				message: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
};
