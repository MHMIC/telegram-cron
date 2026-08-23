import { describe, it, expect } from 'vitest';
import { extractAudioFilename, secretsMatch } from '../../src/utils';

describe('utils', () => {
	describe('extractAudioFilename', () => {
		it('should extract filename and create clean title from a simple URL', () => {
			const url = 'https://example.com/audio/my-audio-file.mp3';
			const result = extractAudioFilename(url);

			expect(result.filename).toBe('my-audio-file.mp3');
			expect(result.cleanTitle).toBe('my audio file');
		});

		it('should handle URLs with query parameters', () => {
			const url = 'https://media.blubrry.com/fajrreminders/files.mhmic.org/Fajr-Reminders/2025/Rights-of-Rasoolullah-2-Ita-at-.mp3?_=1';
			const result = extractAudioFilename(url);

			expect(result.filename).toBe('Rights-of-Rasoolullah-2-Ita-at-.mp3');
			expect(result.cleanTitle).toBe('Rights of Rasoolullah 2 Ita at ');
		});

		it('should handle URLs with multiple hyphens', () => {
			const url = 'https://example.com/audio/this-is-a-long-audio-title.mp3';
			const result = extractAudioFilename(url);

			expect(result.filename).toBe('this-is-a-long-audio-title.mp3');
			expect(result.cleanTitle).toBe('this is a long audio title');
		});

		it('should return default filename when URL has no filename', () => {
			const url = 'https://example.com/audio/';
			const result = extractAudioFilename(url);

			expect(result.filename).toBe('audio.mp3');
			expect(result.cleanTitle).toBe('audio');
		});

		it('should handle URLs without file extension', () => {
			const url = 'https://example.com/audio/my-audio-file';
			const result = extractAudioFilename(url);

			expect(result.filename).toBe('my-audio-file');
			expect(result.cleanTitle).toBe('my audio file');
		});

		it('should handle URLs with trailing hyphens', () => {
			const url = 'https://example.com/audio/my-audio-file-.mp3';
			const result = extractAudioFilename(url);

			expect(result.filename).toBe('my-audio-file-.mp3');
			expect(result.cleanTitle).toBe('my audio file ');
		});

		it('should handle empty string', () => {
			const url = '';
			const result = extractAudioFilename(url);

			expect(result.filename).toBe('audio.mp3');
			expect(result.cleanTitle).toBe('audio');
		});

		it('should handle URL with only domain', () => {
			const url = 'https://example.com';
			const result = extractAudioFilename(url);

			expect(result.filename).toBe('example.com');
			expect(result.cleanTitle).toBe('example.com');
		});
	});

	describe('secretsMatch', () => {
		it('should accept an exact match', () => {
			expect(secretsMatch('s3cret-token', 's3cret-token')).toBe(true);
		});

		it('should reject a value differing in a single character', () => {
			expect(secretsMatch('s3cret-tokeN', 's3cret-token')).toBe(false);
		});

		it('should reject a value of a different length', () => {
			expect(secretsMatch('s3cret-token-extra', 's3cret-token')).toBe(false);
			expect(secretsMatch('', 's3cret-token')).toBe(false);
		});

		it('should reject a prefix of the expected secret', () => {
			expect(secretsMatch('s3cret', 's3cret-token')).toBe(false);
		});
	});
});
