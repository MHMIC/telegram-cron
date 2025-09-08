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
			console.error(`Failed to fetch posts: ${data.status} ${data.statusText}`);
			throw new Error(`API request failed with status ${data.status}`);
		}

		const posts: any[] = await data.json();
		
		if (!posts || posts.length === 0) {
			console.error(`No posts found for category: ${category}`);
			throw new Error(`No posts found for category: ${category}`);
		}

		const post = posts[0];
		console.log(`Successfully fetched post: ${post.title?.rendered || post.id}`);
		return post;
	} catch (error) {
		console.error(`Error in getLatestPost for category ${category}:`, error);
		throw error;
	}
};

export const getCountFromWordpress = async (category: 'fr' | 'jk') => {
	try {
		console.log(`Fetching count for category: ${category} from WordPress API`);
		const data = await fetch(`${CATEGORY_API_ENDPOINT}/${categoryIds[category]}`);
		
		if (!data.ok) {
			console.error(`Failed to fetch category count: ${data.status} ${data.statusText}`);
			throw new Error(`Category API request failed with status ${data.status}`);
		}

		const categoryInfo: any = await data.json();
		
		if (!categoryInfo || typeof categoryInfo.count !== 'number') {
			console.error(`Invalid category response for ${category}:`, categoryInfo);
			throw new Error(`Invalid category response: missing or invalid count`);
		}

		console.log(`Successfully fetched count for category ${category}: ${categoryInfo.count}`);
		return categoryInfo.count as number;
	} catch (error) {
		console.error(`Error in getCountFromWordpress for category ${category}:`, error);
		throw error;
	}
};
