import {
	getLatestPost,
	getCountFromWordpress,
	getHTML,
	getAudioUrl,
} from './wordpress';
import { sendTelegramAudio, sendTelegramMessage } from './telegram';
import { getCountFromKV, updateKVCount } from './kv';

const send = async (env: Env) => {
	const post = await getLatestPost('fr');
	const html = await getHTML(post.slug);
	const audioSrc = getAudioUrl(html);

	if (audioSrc) {
		await sendTelegramAudio(audioSrc, env);
	}
};

export default {
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