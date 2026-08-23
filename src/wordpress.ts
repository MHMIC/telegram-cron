// WordPress API Configuration
const WEBSITE = 'https://mhmic.org';
const API_ENDPOINT = `${WEBSITE}/wp-json/wp/v2/posts`;

// Category configuration
const CATEGORIES = {
	FR: { id: '2', name: 'Fajr Reminders' },
	JK: { id: '3', name: 'Jummah Khutbah' },
} as const;

export type Category = keyof typeof CATEGORIES;

// WordPress API Types
export interface WordPressPost {
	id: number;
	slug: string;
	title: {
		rendered: string;
	};
	content: {
		rendered: string;
	};
	date: string;
	date_gmt: string;
	modified: string;
	link: string;
	categories: number[];
}

/**
 * Returns a post's publish time as epoch milliseconds.
 *
 * WordPress serves `date_gmt` without a timezone suffix, so it is pinned to UTC
 * before parsing; `date` (site local time) is only a fallback.
 */
export const getPublishedAt = (post: Pick<WordPressPost, 'date' | 'date_gmt'>): number => {
	const raw = post.date_gmt ? (post.date_gmt.endsWith('Z') ? post.date_gmt : `${post.date_gmt}Z`) : post.date;
	const publishedAt = Date.parse(raw);

	if (Number.isNaN(publishedAt)) {
		throw new Error(`Unparseable post date: ${post.date_gmt || post.date}`);
	}

	return publishedAt;
};

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
