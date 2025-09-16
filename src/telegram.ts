import { env } from 'cloudflare:workers';
import { extractAudioFilename } from './utils';

export const sendTelegramMessage = async (text: string) => {
	try {
		console.log(`Sending message to chat: ${env.MAIN_CHAT_ID}`);
		const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				chat_id: env.MAIN_CHAT_ID,
				text: text,
			}),
		});

		if (!response.ok) {
			const errorData = (await response.json()) as any;
			throw new Error(`Telegram API error: ${response.status} - ${errorData.description || 'Unknown error'}`);
		}

		console.log('Message sent successfully');
	} catch (error) {
		console.error('Error sending Telegram message:', error);
		throw error;
	}
};

export const sendTelegramAudio = async (audioUrl: string) => {
	if (!audioUrl || !audioUrl.startsWith('http')) {
		throw new Error(`Invalid audio URL: ${audioUrl}`);
	}

	// Extract filename from URL
	const { filename, cleanTitle } = extractAudioFilename(audioUrl);

	// Download the file and upload as multipart form data
	const audioResponse = await fetch(audioUrl);

	if (!audioResponse.ok) {
		throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
	}

	const audioBuffer = await audioResponse.arrayBuffer();

	// Create multipart form data
	const formData = new FormData();
	formData.append('chat_id', env.MAIN_CHAT_ID);
	formData.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }), filename);
	formData.append('title', cleanTitle);

	const uploadResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendAudio`, {
		method: 'POST',
		body: formData,
	});

	if (!uploadResponse.ok) {
		const errorData = (await uploadResponse.json()) as any;
		throw new Error(`Failed to upload audio: ${uploadResponse.status} - ${errorData.description || 'Unknown error'}`);
	}
};

export const sendErrorNotification = async (error: string) => {
	if (!env.NOTIFICATIONS_CHAT_ID) {
		console.log('NOTIFICATIONS_CHAT_ID not configured, skipping error notification');
		return;
	}

	try {
		const errorMessage = `🚨 MHMIC Bot Error:\n\n${error}`;
		const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				chat_id: env.NOTIFICATIONS_CHAT_ID,
				text: errorMessage,
			}),
		});

		if (!response.ok) {
			const errorData = (await response.json()) as any;
			throw new Error(`Telegram API error: ${response.status} - ${errorData.description || 'Unknown error'}`);
		}

		console.log('Error notification sent successfully');
	} catch (notificationError) {
		console.error('Failed to send error notification:', notificationError);
	}
};
