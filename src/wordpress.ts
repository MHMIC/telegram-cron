const WEBSITE = 'https://mhmic.org';
const API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/posts`;
const CATEGORY_API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/categories`;

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

	try {
		console.log(`Fetching latest post for category: ${category} from ${endpoint}`);
		const data = await fetch(endpoint);
		
		if (!data.ok) {
			throw new Error(`HTTP ${data.status}: ${data.statusText}`);
		}
		
		const posts: any[] = await data.json();
		
		if (!posts || posts.length === 0) {
			throw new Error(`No posts found for category: ${category}`);
		}
		
		const post = posts[0];
		console.log(`Successfully fetched post: ${post.slug}`);
		return post;
	} catch (error) {
		console.error(`Error fetching latest post for category ${category}:`, error);
		throw error;
	}
};

export const getCountFromWordpress = async (category: 'fr' | 'jk') => {
	try {
		console.log(`Fetching count for category: ${category}`);
		const data = await fetch(`${CATEGORY_API_ENDPOINT}/${categoryIds[category]}`);
		
		if (!data.ok) {
			throw new Error(`HTTP ${data.status}: ${data.statusText}`);
		}
		
		const categoryInfo: any = await data.json();
		
		if (!categoryInfo || typeof categoryInfo.count !== 'number') {
			throw new Error(`Invalid category info response for category: ${category}`);
		}
		
		console.log(`Successfully fetched count for ${category}: ${categoryInfo.count}`);
		return categoryInfo.count as number;
	} catch (error) {
		console.error(`Error fetching count for category ${category}:`, error);
		throw error;
	}
};
