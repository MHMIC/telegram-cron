import { Telegraf } from 'telegraf';

interface ErrorNotificationData {
	error: Error | unknown;
	context: string;
	timestamp: Date;
	severity: 'low' | 'medium' | 'high' | 'critical';
}

interface NotificationConfig {
	enabled: boolean;
	errorChatId?: string;
	rateLimitMinutes: number;
}

// Simple in-memory rate limiting (resets on worker restart)
const lastNotificationTimes = new Map<string, number>();

export class NotificationService {
	private config: NotificationConfig;
	private env: Env;

	constructor(env: Env) {
		this.env = env;
		this.config = {
			enabled: true, // Always enabled by default
			errorChatId: env.ERROR_CHAT_ID,
			rateLimitMinutes: parseInt(env.ERROR_NOTIFICATION_RATE_LIMIT || '15'), // Default 15 minutes
		};
	}

	private shouldSendNotification(context: string): boolean {
		if (!this.config.enabled) {
			return false;
		}

		const now = Date.now();
		const lastNotification = lastNotificationTimes.get(context);
		const rateLimitMs = this.config.rateLimitMinutes * 60 * 1000;

		if (lastNotification && now - lastNotification < rateLimitMs) {
			console.log(`Rate limiting error notification for context: ${context}`);
			return false;
		}

		lastNotificationTimes.set(context, now);
		return true;
	}

	private formatErrorMessage(data: ErrorNotificationData): string {
		const { error, context, timestamp, severity } = data;

		const severityEmoji = {
			low: '⚠️',
			medium: '🔶',
			high: '🔴',
			critical: '🚨',
		};

		const errorMessage = error instanceof Error ? error.message : String(error);
		const stack = error instanceof Error ? error.stack : undefined;

		let message = `${severityEmoji[severity]} **MHMIC Telegram Cron Error**\n\n`;
		message += `**Context:** ${context}\n`;
		message += `**Time:** ${timestamp.toISOString()}\n`;
		message += `**Severity:** ${severity.toUpperCase()}\n`;
		message += `**Error:** ${errorMessage}\n`;

		if (stack && severity === 'critical') {
			// Only include stack trace for critical errors to avoid spam
			message += `\n**Stack Trace:**\n\`\`\`\n${stack.substring(0, 1000)}\n\`\`\``;
		}

		return message;
	}

	private async sendTelegramNotification(message: string): Promise<void> {
		if (!this.config.errorChatId) {
			console.error('ERROR_CHAT_ID not configured - error notifications disabled');
			return;
		}

		try {
			const bot = new Telegraf(this.env.TELEGRAM_BOT_TOKEN);
			await bot.telegram.sendMessage(this.config.errorChatId, message, {
				parse_mode: 'Markdown',
			});
			console.log(`Error notification sent via Telegram to error chat: ${this.config.errorChatId}`);
		} catch (error) {
			console.error('Failed to send Telegram error notification:', error);
		}
	}

	public async notifyError(data: ErrorNotificationData): Promise<void> {
		if (!this.shouldSendNotification(data.context)) {
			return;
		}

		const message = this.formatErrorMessage(data);

		console.log(`Sending error notification for context: ${data.context}`);

		// Send Telegram notification
		try {
			await this.sendTelegramNotification(message);
		} catch (error) {
			console.error('Error sending notification:', error);
		}
	}
}

// Convenience functions for different error severities
export async function notifyLowSeverityError(env: Env, error: Error | unknown, context: string): Promise<void> {
	const service = new NotificationService(env);
	await service.notifyError({
		error,
		context,
		timestamp: new Date(),
		severity: 'low',
	});
}

export async function notifyMediumSeverityError(env: Env, error: Error | unknown, context: string): Promise<void> {
	const service = new NotificationService(env);
	await service.notifyError({
		error,
		context,
		timestamp: new Date(),
		severity: 'medium',
	});
}

export async function notifyHighSeverityError(env: Env, error: Error | unknown, context: string): Promise<void> {
	const service = new NotificationService(env);
	await service.notifyError({
		error,
		context,
		timestamp: new Date(),
		severity: 'high',
	});
}

export async function notifyCriticalError(env: Env, error: Error | unknown, context: string): Promise<void> {
	const service = new NotificationService(env);
	await service.notifyError({
		error,
		context,
		timestamp: new Date(),
		severity: 'critical',
	});
}
