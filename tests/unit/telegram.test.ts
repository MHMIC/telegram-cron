import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendErrorNotification } from '../../src/telegram';

const captureSentText = () => {
	const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

	return {
		spy,
		body: () => JSON.parse(String((spy.mock.calls[0][1] as RequestInit).body)) as { chat_id: string; text: string },
	};
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('sendErrorNotification', () => {
	it('should mask recipient addresses before they reach the chat', async () => {
		const { spy, body } = captureSentText();

		await sendErrorNotification('Reminder email failed: fajr-reminders@googlegroups.com was rejected');

		expect(spy).toHaveBeenCalledOnce();
		expect(body().text).toContain('***@googlegroups.com');
		expect(body().text).not.toContain('fajr-reminders@googlegroups.com');
	});

	it('should mask every address in a multi-recipient failure', async () => {
		const { body } = captureSentText();

		await sendErrorNotification('failed: one@example.com; two@lists.example.org');

		expect(body().text).not.toMatch(/\bone@|\btwo@/);
		expect(body().text).toContain('***@example.com');
		expect(body().text).toContain('***@lists.example.org');
	});

	it('should leave an error with no addresses unchanged', async () => {
		const { body } = captureSentText();

		await sendErrorNotification('WordPress API error: 503 Service Unavailable');

		expect(body().text).toContain('WordPress API error: 503 Service Unavailable');
	});
});
