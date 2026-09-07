import { env } from 'cloudflare:workers';
import { extractAudioFilename, redactEmails } from './utils';
import { parseBuffer } from 'music-metadata';

// Telegram rejects bot uploads larger than 50 MB, and the whole file is held in
// memory here, so oversized audio is rejected before it is downloaded.
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

interface TelegramErrorResponse {
	description?: string;
}

const telegramUrl = (method: string) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

const assertTelegramOk = async (response: Response, action: string) => {
	if (response.ok) {
		return;
	}

	const errorData = (await response.json().catch(() => ({}))) as TelegramErrorResponse;
	throw new Error(`${action} failed: ${response.status} - ${errorData.description || 'Unknown error'}`);
};

const sendMessage = async (chatId: string, text: string) => {
	const response = await fetch(telegramUrl('sendMessage'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			chat_id: chatId,
			text,
		}),
	});

	await assertTelegramOk(response, 'Telegram sendMessage');
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

	const declaredLength = Number(audioResponse.headers.get('content-length'));

	if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_BYTES) {
		throw new Error(`Audio is too large to send: ${declaredLength} bytes exceeds the ${MAX_AUDIO_BYTES} byte limit`);
	}

	const audioBuffer = await audioResponse.arrayBuffer();

	if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
		throw new Error(`Audio is too large to send: ${audioBuffer.byteLength} bytes exceeds the ${MAX_AUDIO_BYTES} byte limit`);
	}

	// Parse metadata
	let duration: number | undefined;
	let title = cleanTitle;
	let performer: string | undefined;

	try {
		const uint8Array = new Uint8Array(audioBuffer);
		const metadata = await parseBuffer(uint8Array);

		if (metadata.format.duration) {
			duration = Math.round(metadata.format.duration);
		}

		if (metadata.common.title) {
			title = metadata.common.title;
		}

		if (metadata.common.artist) {
			performer = metadata.common.artist;
		}

		console.log(`Extracted metadata - Duration: ${duration}s, Title: ${title}, Performer: ${performer}`);
	} catch (error) {
		console.error('Failed to parse audio metadata:', error);
		// Fallback to defaults if parsing fails
	}

	// Create multipart form data
	const formData = new FormData();
	formData.append('chat_id', env.MAIN_CHAT_ID);
	formData.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }), filename);
	formData.append('title', title);

	if (duration) {
		formData.append('duration', duration.toString());
	}

	if (performer) {
		formData.append('performer', performer);
	}

	const uploadResponse = await fetch(telegramUrl('sendAudio'), {
		method: 'POST',
		body: formData,
	});

	await assertTelegramOk(uploadResponse, 'Telegram sendAudio');
};

export const sendErrorNotification = async (error: string) => {
	if (!env.NOTIFICATIONS_CHAT_ID) {
		console.log('NOTIFICATIONS_CHAT_ID not configured, skipping error notification');
		return;
	}

	try {
		await sendMessage(env.NOTIFICATIONS_CHAT_ID, `🚨 MHMIC Bot Error:\n\n${redactEmails(error)}`);
		console.log('Error notification sent successfully');
	} catch (notificationError) {
		console.error('Failed to send error notification:', notificationError);
	}
};
