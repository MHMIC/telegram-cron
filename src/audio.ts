import { load } from 'cheerio';

const WEBSITE = 'https://mhmic.org';
const FR_LINK = `${WEBSITE}/fajrreminders`;

export const getHTML = async (slug: string) => {
	try {
		console.log(`Fetching HTML for slug: ${slug}`);
		const data = await fetch(`${FR_LINK}/${slug}`);
		
		if (!data.ok) {
			console.error(`Failed to fetch HTML for slug ${slug}: ${data.status} ${data.statusText}`);
			throw new Error(`HTML fetch failed with status ${data.status}`);
		}

		const html = await data.text();
		
		if (!html || html.trim().length === 0) {
			console.error(`Empty HTML response for slug: ${slug}`);
			throw new Error(`Empty HTML response for slug: ${slug}`);
		}

		console.log(`Successfully fetched HTML for slug: ${slug} (${html.length} characters)`);
		return html;
	} catch (error) {
		console.error(`Error in getHTML for slug ${slug}:`, error);
		throw error;
	}
};

export const getAudioUrl = (html: string) => {
	try {
		console.log(`Parsing HTML to extract audio URL`);
		const $ = load(html);
		const audioSrc = $('audio source').attr('src');
		
		if (!audioSrc) {
			console.error(`No audio source found in HTML`);
			throw new Error(`No audio source found in HTML`);
		}

		console.log(`Successfully extracted audio URL: ${audioSrc}`);
		return audioSrc;
	} catch (error) {
		console.error(`Error in getAudioUrl:`, error);
		throw error;
	}
};
