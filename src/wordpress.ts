import { load } from 'cheerio';

const WEBSITE = 'https://mhmic.org';
const API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/posts`;
const CATEGORY_API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/categories`;
const FR_LINK = `${WEBSITE}/fajrreminders`;

const categoryIds = {
	fr: '2',
	jk: '3',
};

export const getLatestPost = async (category: 'fr' | 'jk') => {
	let endpoint = API_ENDPOINT;
	if (category === 'fr') {
		endpoint = `${API_ENDPOINT}/?per_page=1&categories=2`;
	} else {
		endpoint = `${API_ENDPOINT}/?per_page=1&categories=3`;
	}

	const data = await fetch(endpoint);
	const posts: any[] = await data.json();
	const post = posts[0];

	return post;
};

export const getCountFromWordpress = async (category: 'fr' | 'jk') => {
	const data = await fetch(`${CATEGORY_API_ENDPOINT}/${categoryIds[category]}`);
	const categoryInfo: any = await data.json();

	return categoryInfo.count as number;
};

export const getHTML = async (slug: string) => {
	const data = await fetch(`${FR_LINK}/${slug}`);
	const html = await data.text();
	return html;
};

export const getAudioUrl = (html: string) => {
	const $ = load(html);
	const audioSrc = $('audio source').attr('src');
	return audioSrc;
};
