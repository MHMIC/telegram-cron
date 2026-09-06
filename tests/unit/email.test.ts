import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// `cloudflare:workers` exposes the same bindings the module under test reads,
// and unlike the `cloudflare:test` copy it is writable, so configuration can be
// varied per case.
import { env } from 'cloudflare:workers';
import { buildReminderEmail, parseRecipients, sendReminderEmail } from '../../src/email';

const POST = {
	slug: 'a-reminder',
	link: 'https://mhmic.org/fajrreminders/a-reminder',
	title: { rendered: 'Rights of Rasoolullah &#8217;s Ummah &amp; Us' },
};

const AUDIO_URL = 'https://files.mhmic.org/Fajr-Reminders/2025/a-reminder.mp3';

describe('buildReminderEmail', () => {
	it('should decode HTML entities in the title', () => {
		const { subject } = buildReminderEmail(POST, AUDIO_URL);

		expect(subject).toBe('New Fajr Reminder: Rights of Rasoolullah ’s Ummah & Us');
	});

	it('should link to the post and the audio in both bodies', () => {
		const { text, html } = buildReminderEmail(POST, AUDIO_URL);

		expect(text).toContain(POST.link);
		expect(text).toContain(AUDIO_URL);
		expect(html).toContain(`href="${POST.link}"`);
		expect(html).toContain(`href="${AUDIO_URL}"`);
	});

	it('should escape the title in the HTML body', () => {
		const { html } = buildReminderEmail({ ...POST, title: { rendered: '&lt;script&gt;alert(1)&lt;/script&gt;' } }, AUDIO_URL);

		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(html).not.toContain('<script>');
	});

	it('should fall back to the slug when the title is empty', () => {
		const { subject } = buildReminderEmail({ ...POST, title: { rendered: '' } }, AUDIO_URL);

		expect(subject).toBe('New Fajr Reminder: a-reminder');
	});
});

describe('parseRecipients', () => {
	it('should split a comma separated list and trim each address', () => {
		expect(parseRecipients(' one@example.com , two@example.com ')).toEqual(['one@example.com', 'two@example.com']);
	});

	it('should return an empty list for unset or blank values', () => {
		expect(parseRecipients(undefined)).toEqual([]);
		expect(parseRecipients('  ,  ')).toEqual([]);
	});
});

describe('sendReminderEmail', () => {
	const originalSend = env.SEND_EMAIL.send;
	const originalTo = env.EMAIL_TO;
	const originalFrom = env.EMAIL_FROM;
	let send: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		send = vi.fn(async () => ({ messageId: 'test-message-id' }));
		env.SEND_EMAIL.send = send as typeof env.SEND_EMAIL.send;
	});

	afterEach(() => {
		env.SEND_EMAIL.send = originalSend;
		env.EMAIL_TO = originalTo;
		env.EMAIL_FROM = originalFrom;
	});

	it('should send one message with the configured sender and recipient', async () => {
		await sendReminderEmail(POST, AUDIO_URL);

		expect(send).toHaveBeenCalledOnce();
		expect(send.mock.calls[0][0]).toMatchObject({
			to: 'subscriber@example.com',
			from: { name: 'MHMIC Fajr Reminders', email: 'reminders@mhmic.org' },
			subject: 'New Fajr Reminder: Rights of Rasoolullah ’s Ummah & Us',
		});
	});

	it('should send both a text and an HTML body', async () => {
		await sendReminderEmail(POST, AUDIO_URL);

		const message = send.mock.calls[0][0];

		expect(message.text).toContain(AUDIO_URL);
		expect(message.html).toContain('<h1');
	});

	it('should mark the message as auto-generated so lists do not autoreply', async () => {
		await sendReminderEmail(POST, AUDIO_URL);

		expect(send.mock.calls[0][0].headers).toMatchObject({ 'Auto-Submitted': 'auto-generated' });
	});

	it('should send a separate message per recipient rather than one shared To', async () => {
		env.EMAIL_TO = 'one@example.com, two@example.com';

		await sendReminderEmail(POST, AUDIO_URL);

		expect(send).toHaveBeenCalledTimes(2);
		expect(send.mock.calls.map((call) => call[0].to)).toEqual(['one@example.com', 'two@example.com']);
	});

	it('should skip sending when no recipients are configured', async () => {
		env.EMAIL_TO = '';

		await sendReminderEmail(POST, AUDIO_URL);

		expect(send).not.toHaveBeenCalled();
	});

	it('should skip sending when the sender address is not configured', async () => {
		env.EMAIL_FROM = '';

		await sendReminderEmail(POST, AUDIO_URL);

		expect(send).not.toHaveBeenCalled();
	});

	it('should still deliver to the remaining recipients when one address fails', async () => {
		env.EMAIL_TO = 'bad@example.com, good@example.com';
		send.mockImplementation(async (message: { to: string }) => {
			if (message.to === 'bad@example.com') {
				throw new Error('not a verified destination');
			}

			return { messageId: 'test-message-id' };
		});

		await expect(sendReminderEmail(POST, AUDIO_URL)).rejects.toThrow(/1 of 2 recipient/);

		expect(send).toHaveBeenCalledTimes(2);
	});

	it('should keep recipient addresses out of the error it throws', async () => {
		// The message is forwarded to the notifications chat, so it must not
		// carry the recipient list.
		env.EMAIL_TO = 'bad@example.com, good@example.com';
		send.mockImplementation(async (message: { to: string }) => {
			if (message.to === 'bad@example.com') {
				throw new Error('not a verified destination');
			}

			return { messageId: 'test-message-id' };
		});

		await expect(sendReminderEmail(POST, AUDIO_URL)).rejects.toThrow(
			expect.objectContaining({ message: expect.not.stringContaining('bad@example.com') }),
		);
	});
});

describe('sendReminderEmail against the real binding', () => {
	// The suite above stubs send(), so it would pass even if the payload shape
	// were wrong. This one hands the message to the runtime unstubbed, which is
	// what actually validates the structured send() fields.
	it('should be accepted by the Email Service binding', async () => {
		await expect(sendReminderEmail(POST, AUDIO_URL)).resolves.toBeUndefined();
	});
});
