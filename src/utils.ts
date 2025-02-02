export function cleanMp3Filename(url: string): string {
	const match = url.match(/(.+?\.mp3)\b/);
	return match ? match[1] : url;
}
