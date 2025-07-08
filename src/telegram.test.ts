import { describe, it, expect } from 'vitest';
import { sendTelegramMessage, sendTelegramAudio } from './telegram';

const MOCK_ENV = {
	TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234567890',
	CHAT_ID: '123456789',
} as any;

describe('telegram', () => {
	it('sendTelegramMessage', async () => {
		await sendTelegramMessage('test', MOCK_ENV);
	});

	it('sendTelegramAudio', async () => {
		await sendTelegramAudio('https://example.com/audio.mp3', MOCK_ENV);
	});
});
