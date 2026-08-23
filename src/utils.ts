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
