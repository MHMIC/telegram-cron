import { describe, it, expect } from 'vitest';
import { extractAudioFilename, cleanMp3Filename } from '../../src/utils';

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

	describe('cleanMp3Filename', () => {
		it('should extract MP3 filename from URL', () => {
			const url = 'https://example.com/audio/test-file.mp3?param=value';
			const result = cleanMp3Filename(url);
			
			expect(result).toBe('test-file.mp3');
		});

		it('should return original URL if no MP3 extension found', () => {
			const url = 'https://example.com/audio/test-file.wav';
			const result = cleanMp3Filename(url);
			
			expect(result).toBe(url);
		});

		it('should handle URLs with MP3 in the middle', () => {
			const url = 'https://example.com/audio/test-file.mp3/extra-path';
			const result = cleanMp3Filename(url);
			
			expect(result).toBe('test-file.mp3');
		});
	});
});
