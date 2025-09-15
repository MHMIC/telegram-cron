import { load } from 'cheerio';

const WEBSITE = 'https://mhmic.org';
const FR_LINK = `${WEBSITE}/fajrreminders`;

export const getHTML = async (slug: string) => {
	try {
		console.log(`Fetching HTML for slug: ${slug}`);
		const url = `${FR_LINK}/${slug}`;
		const data = await fetch(url);
		
		if (!data.ok) {
			throw new Error(`HTTP ${data.status}: ${data.statusText} for URL: ${url}`);
		}
		
		const html = await data.text();
		
		if (!html || html.trim().length === 0) {
			throw new Error(`Empty HTML response for slug: ${slug}`);
		}
		
		console.log(`Successfully fetched HTML for slug: ${slug}`);
		return html;
	} catch (error) {
		console.error(`Error fetching HTML for slug ${slug}:`, error);
		throw error;
	}
};

export const getAudioUrl = (html: string) => {
	try {
		console.log('Extracting audio URL from HTML');
		const $ = load(html);
		const audioSrc = $('audio source').attr('src');
		
		if (!audioSrc) {
			throw new Error('No audio source found in HTML');
		}
		
		// Convert relative URLs to absolute URLs
		const fullAudioUrl = audioSrc.startsWith('http') ? audioSrc : `${WEBSITE}${audioSrc}`;
		
		console.log(`Successfully extracted audio URL: ${fullAudioUrl}`);
		return fullAudioUrl;
	} catch (error) {
		console.error('Error extracting audio URL:', error);
		throw error;
	}
};
