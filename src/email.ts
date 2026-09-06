import { env } from 'cloudflare:workers';
import type { WordPressPost } from './wordpress';
import { escapeHtml, htmlToText } from './utils';

const FROM_NAME = 'MHMIC Fajr Reminders';

export interface ReminderEmail {
	subject: string;
	text: string;
	html: string;
}

/**
 * Composes the notification for a reminder. The audio itself is not attached:
 * the mail links to the post and the audio file instead, which keeps the message
 * well inside Email Service's size limit.
 */
export const buildReminderEmail = (post: Pick<WordPressPost, 'title' | 'link' | 'slug'>, audioUrl: string): ReminderEmail => {
	const title = htmlToText(post.title.rendered) || post.slug;
	const safeTitle = escapeHtml(title);
	const safeLink = escapeHtml(post.link);
	const safeAudioUrl = escapeHtml(audioUrl);

	const text = [
		'A new Fajr Reminder has been posted.',
		'',
		title,
		'',
		`Listen on the website: ${post.link}`,
		`Audio file: ${audioUrl}`,
		'',
		'— MHMIC Fajr Reminders',
	].join('\n');

	const html = [
		'<!doctype html>',
		'<html lang="en">',
		'<body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,' +
			"'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2933;\">",
		'<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">',
		'<p style="margin:0 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#7b8794;">New Fajr Reminder</p>',
		`<h1 style="margin:0 0 20px;font-size:20px;line-height:1.35;">${safeTitle}</h1>`,
		`<p style="margin:0 0 12px;"><a href="${safeLink}" style="color:#2b6cb0;">Listen on the website</a></p>`,
		`<p style="margin:0 0 24px;"><a href="${safeAudioUrl}" style="color:#2b6cb0;">Download the audio file</a></p>`,
		'<p style="margin:0;font-size:13px;color:#7b8794;">MHMIC Fajr Reminders</p>',
		'</div>',
		'</body>',
		'</html>',
	].join('\n');

	return { subject: `New Fajr Reminder: ${title}`, text, html };
};

/**
 * EMAIL_TO holds a comma separated list so a handful of addresses can be
 * notified without a config change per address.
 */
export const parseRecipients = (value: string | undefined): string[] =>
	(value || '')
		.split(',')
		.map((recipient) => recipient.trim())
		.filter(Boolean);

/**
 * Emails the reminder to every configured recipient.
 *
 * Skipped when the addresses are unset, matching how error notifications treat
 * an unconfigured NOTIFICATIONS_CHAT_ID.
 *
 * Each recipient gets its own message rather than one message addressed to all
 * of them. The recipients are mailing lists that do not need to see each other
 * in the To header, and a rejection then fails only the list it belongs to —
 * every recipient is attempted before this throws.
 */
export const sendReminderEmail = async (post: Pick<WordPressPost, 'title' | 'link' | 'slug'>, audioUrl: string): Promise<void> => {
	const recipients = parseRecipients(env.EMAIL_TO);

	if (!env.SEND_EMAIL || !env.EMAIL_FROM || recipients.length === 0) {
		console.log('Email notifications are not configured, skipping reminder email');
		return;
	}

	const { subject, text, html } = buildReminderEmail(post, audioUrl);
	const failures: string[] = [];

	for (const to of recipients) {
		try {
			const { messageId } = await env.SEND_EMAIL.send({
				to,
				from: { name: FROM_NAME, email: env.EMAIL_FROM },
				subject,
				text,
				html,
				headers: {
					// Reminders fan out to mailing lists, where a single member's
					// out-of-office would otherwise reply back to the whole list.
					// RFC 3834 tells conforming responders to stay quiet.
					'Auto-Submitted': 'auto-generated',
				},
			});

			console.log(`Reminder email sent to ${to} (${messageId})`);
		} catch (error) {
			failures.push(`${to} (${error instanceof Error ? error.message : 'Unknown error'})`);
			console.error(`Failed to send reminder email to ${to}:`, error);
		}
	}

	if (failures.length > 0) {
		throw new Error(`Reminder email failed for ${failures.length} of ${recipients.length} recipient(s): ${failures.join('; ')}`);
	}
};
