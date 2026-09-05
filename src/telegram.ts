import { env } from 'cloudflare:workers';
import { extractAudioFilename } from './utils';
import type { Enclosure } from './feed';
import { parseBuffer } from 'music-metadata';

// Telegram fetches the file itself at this size or below, so nothing passes
// through the worker.
const MAX_URL_SEND_BYTES = 20 * 1024 * 1024;

// Telegram rejects bot uploads larger than 50 MB, and the whole file is held in
// memory on the upload path, so oversized audio is rejected before download.
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	ogg: 'audio/ogg',
	opus: 'audio/ogg',
	wav: 'audio/wav',
	flac: 'audio/flac',
};

const extensionOf = (url: string): string => {
	try {
		return new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
	} catch {
		return '';
	}
};

// The feed's declared type is unreliable — a .wav has been seen announced as
// audio/mpeg — so the extension wins.
const mimeFor = (url: string, declaredType: string): string => MIME_BY_EXTENSION[extensionOf(url)] || declaredType || 'application/octet-stream';

// extractAudioFilename only strips a .mp3 suffix, which leaves the extension
// visible in the Telegram title for any other format.
const stripExtension = (title: string): string => title.replace(/\.(mp3|m4a|ogg|opus|wav|flac)$/i, '');

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

export const sendTelegramAudio = async (enclosure: Enclosure) => {
	const { url, length, declaredType } = enclosure;

	if (!url || !url.startsWith('http')) {
		throw new Error(`Invalid audio URL: ${url}`);
	}

	const { filename, cleanTitle } = extractAudioFilename(url);
	const title = stripExtension(cleanTitle);
	const mimeType = mimeFor(url, declaredType);

	if (length > MAX_AUDIO_BYTES) {
		throw new Error(
			`Audio is too large to send: ${length} bytes exceeds the ${MAX_AUDIO_BYTES} byte limit. ` +
				'Re-publish the episode as an mp3 — a full-length WAV will always exceed this.'
		);
	}

	// Preferred path: hand Telegram the URL. Downloading into the worker risks
	// exhausting the 128 MB isolate long before the 50 MB guard below fires — a
	// 104 MB WAV episode is what surfaced this.
	if (length > 0 && length <= MAX_URL_SEND_BYTES) {
		const response = await fetch(telegramUrl('sendAudio'), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				chat_id: env.MAIN_CHAT_ID,
				audio: url,
				title,
			}),
		});

		await assertTelegramOk(response, 'Telegram sendAudio (by URL)');
		console.log(`Sent audio by URL: ${url} (${length} bytes)`);
		return;
	}

	// Fallback: buffer and upload. Used between 20 and 50 MB, or when the feed
	// omitted the length and the URL limit cannot be ruled out.
	console.log(`Buffering audio for upload: ${url} (${length || 'unknown'} bytes)`);

	const audioResponse = await fetch(url);

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
	let uploadTitle = title;
	let performer: string | undefined;

	try {
		const uint8Array = new Uint8Array(audioBuffer);
		const metadata = await parseBuffer(uint8Array, mimeType);

		if (metadata.format.duration) {
			duration = Math.round(metadata.format.duration);
		}

		if (metadata.common.title) {
			uploadTitle = metadata.common.title;
		}

		if (metadata.common.artist) {
			performer = metadata.common.artist;
		}

		console.log(`Extracted metadata - Duration: ${duration}s, Title: ${uploadTitle}, Performer: ${performer}`);
	} catch (error) {
		console.error('Failed to parse audio metadata:', error);
		// Fallback to defaults if parsing fails
	}

	// Create multipart form data
	const formData = new FormData();
	formData.append('chat_id', env.MAIN_CHAT_ID);
	formData.append('audio', new Blob([audioBuffer], { type: mimeType }), filename);
	formData.append('title', uploadTitle);

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
		await sendMessage(env.NOTIFICATIONS_CHAT_ID, `🚨 MHMIC Bot Error:\n\n${error}`);
		console.log('Error notification sent successfully');
	} catch (notificationError) {
		console.error('Failed to send error notification:', notificationError);
	}
};
