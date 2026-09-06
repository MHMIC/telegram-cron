import { load } from 'cheerio';

/**
 * Extracts and cleans filename from a URL for audio files
 * @param url - The URL to extract filename from
 * @returns Object containing filename and cleanTitle
 */
export function extractAudioFilename(url: string): { filename: string; cleanTitle: string } {
	// Extract filename from URL
	const urlParts = url.split('/');
	const filename = urlParts[urlParts.length - 1].split('?')[0] || 'audio.mp3';

	// Create clean title by replacing hyphens with spaces and removing .mp3 extension
	const cleanTitle = filename.replace(/-/g, ' ').replace('.mp3', '');

	return { filename, cleanTitle };
}

/**
 * Compares two secrets without leaking where they diverge.
 *
 * The comparison is constant time for equal-length inputs; the length itself is
 * not hidden, which is acceptable for a shared trigger token.
 */
export function secretsMatch(provided: string, expected: string): boolean {
	if (provided.length !== expected.length) {
		return false;
	}

	let mismatch = 0;

	for (let i = 0; i < provided.length; i++) {
		mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
	}

	return mismatch === 0;
}

/**
 * Renders an HTML fragment as plain text.
 *
 * WordPress serves titles with entities already encoded (`&#8217;`, `&amp;`),
 * which would otherwise show up literally in an email subject line.
 */
export function htmlToText(html: string): string {
	return load(html).root().text().replace(/\s+/g, ' ').trim();
}

/**
 * Escapes text for interpolation into an HTML document.
 */
export function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Masks the local part of any email address in a string, keeping the domain.
 *
 * Error text is forwarded to the notifications chat, and a rejection from the
 * mail provider can quote the address it rejected. The domain is the part worth
 * reading there; the full address stays in the logs.
 */
export function redactEmails(text: string): string {
	return text.replace(/[A-Za-z0-9._%+'-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g, '***@$1');
}
