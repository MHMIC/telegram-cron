import { Telegraf } from 'telegraf';

export const sendTelegramMessage = async (text: string, env: Env) => {
	const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
	try {
		console.log(`sending.. to:`, env.CHAT_ID);
		await bot.telegram.sendMessage(env.CHAT_ID, text);
		console.log('Message sent successfully');
	} catch (error) {
		console.log(error);
	}
};

export const sendTelegramAudio = async (audioUrl: string, env: Env) => {
	const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
	try {
		console.log(`sending.. to:`, env.CHAT_ID);
		await bot.telegram.sendAudio(env.CHAT_ID, audioUrl);
		console.log('Audio sent successfully');
	} catch (error) {
		console.log(error);
	}
};
