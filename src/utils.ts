export function cleanMp3Filename(url: string): string {
	const match = url.match(/([^\/]+\.mp3)/);
	return match ? match[1] : url;
}

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
