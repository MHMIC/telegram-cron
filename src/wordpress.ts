// WordPress API Configuration
const WEBSITE = 'https://mhmic.org';
const API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/posts`;
const CATEGORY_API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/categories`;

// Category configuration
const CATEGORIES = {
	FR: { id: '2', name: 'Fajr Reminders' },
	JK: { id: '3', name: 'Jummah Khutbah' },
} as const;

type Category = keyof typeof CATEGORIES;

// WordPress API Types
interface WordPressPost {
	id: number;
	slug: string;
	title: {
		rendered: string;
	};
	content: {
		rendered: string;
	};
	date: string;
	modified: string;
	link: string;
	categories: number[];
}

interface WordPressCategory {
	id: number;
	count: number;
	name: string;
	slug: string;
	description: string;
}

/**
 * Fetches the latest post from a specific category
 */
export const getLatestPost = async (category: Category): Promise<WordPressPost> => {
	const categoryId = CATEGORIES[category].id;
	const endpoint = `${API_ENDPOINT}?per_page=1&categories=${categoryId}&orderby=date&order=desc`;

	try {
		console.log(`Fetching latest post for category: ${category} (${CATEGORIES[category].name})`);

		const response = await fetch(endpoint);

		if (!response.ok) {
			throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
		}

		const posts: WordPressPost[] = await response.json();

		if (!Array.isArray(posts) || posts.length === 0) {
			throw new Error(`No posts found for category: ${category}`);
		}

		const post = posts[0];
		console.log(`Successfully fetched post: "${post.title.rendered}" (${post.slug})`);

		return post;
	} catch (error) {
		const errorMessage = `Failed to fetch latest post for category ${category}`;
		console.error(errorMessage, error);
		throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};

/**
 * Fetches the post count for a specific category from WordPress
 */
export const getCountFromWordpress = async (category: Category): Promise<number> => {
	const categoryId = CATEGORIES[category].id;
	const endpoint = `${CATEGORY_API_ENDPOINT}/${categoryId}`;

	try {
		console.log(`Fetching post count for category: ${category} (${CATEGORIES[category].name})`);

		const response = await fetch(endpoint);

		if (!response.ok) {
			throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
		}

		const categoryInfo: WordPressCategory = await response.json();

		if (!categoryInfo || typeof categoryInfo.count !== 'number') {
			throw new Error(`Invalid category response: missing or invalid count field`);
		}

		console.log(`Successfully fetched count for ${category}: ${categoryInfo.count} posts`);

		return categoryInfo.count;
	} catch (error) {
		const errorMessage = `Failed to fetch post count for category ${category}`;
		console.error(errorMessage, error);
		throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};
