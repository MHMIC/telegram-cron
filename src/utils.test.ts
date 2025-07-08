import { describe, it, expect } from 'vitest';
import { cleanMp3Filename } from './utils';

describe('cleanMp3Filename', () => {
	it('should return the original url if no match is found', () => {
		const url = 'https://example.com/audio';
		const result = cleanMp3Filename(url);
		expect(result).toBe(url);
	});

	it('should extract the mp3 filename', () => {
		const url = 'https://example.com/audio.mp3/something-else';
		const result = cleanMp3Filename(url);
		expect(result).toBe('https://example.com/audio.mp3');
	});
});
