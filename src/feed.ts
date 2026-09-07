/**
 * Media lookup via the podcast feed.
 *
 * The audio URL used to be scraped out of the rendered post page with a
 * `audio source` selector. That coupled the worker to theme output: when an
 * episode was published as a .wav, PowerPress fell back to a link-only player,
 * the selector matched nothing, and every cron run threw for a day.
 *
 * PowerPress publishes the same URL in the feed's <enclosure> tag, which is a
 * stable contract and additionally carries the file size — needed to decide how
 * to hand the file to Telegram.
 */

const FEEDS: Partial<Record<string, string>> = {
	FR: 'https://mhmic.org/feed/podcast/',
	// JK: verify the per-category feed slug before enabling.
};

export interface Enclosure {
	url: string;
	/** Bytes as declared by the feed; 0 when the feed omits the attribute. */
	length: number;
	/** MIME type as declared by the feed. Unreliable — a .wav has been seen announced as audio/mpeg. */
	declaredType: string;
}

const decodeEntities = (value: string): string =>
	value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');

const ITEM_RE = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

// Feed generators vary in how they quote attributes, so double, single and
// unquoted values are all accepted. The leading \b keeps `type` from matching
// the tail of an unrelated attribute name.
const attr = (tag: string, name: string): string | null => {
	const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
	if (!match) {
		return null;
	}
	return decodeEntities(match[1] ?? match[2] ?? match[3]);
};

const text = (item: string, tag: string): string | null => {
	const match = item.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
	if (!match) {
		return null;
	}
	return decodeEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
};

const toEnclosure = (item: string): Enclosure | null => {
	const tag = item.match(/<enclosure\b[^>]*>/i)?.[0];
	if (!tag) {
		return null;
	}

	const url = attr(tag, 'url');
	if (!url || !url.startsWith('http')) {
		return null;
	}

	const length = Number.parseInt(attr(tag, 'length') || '0', 10);

	return {
		url,
		length: Number.isFinite(length) ? length : 0,
		declaredType: attr(tag, 'type') || '',
	};
};

/**
 * Resolves the media file for a post by matching the feed item whose link or
 * guid contains the slug.
 *
 * Throws when no item matches. Feeds are cached more aggressively than the REST
 * API and can lag a freshly published post by a few minutes, but falling back to
 * the newest item would send the *previous* episode's audio — and the caller
 * records the post as delivered on success, so the real audio would never go
 * out. Failing instead leaves the position unchanged and the next cron tick
 * retries once the feed catches up.
 */
export const getEnclosure = async (category: string, slug: string): Promise<Enclosure> => {
	const feedUrl = FEEDS[category];

	if (!feedUrl) {
		throw new Error(`No podcast feed configured for category: ${category}`);
	}

	console.log(`Fetching podcast feed for ${category}: ${feedUrl}`);

	const response = await fetch(feedUrl, { headers: { accept: 'application/rss+xml, application/xml;q=0.9' } });

	if (!response.ok) {
		throw new Error(`Podcast feed error: ${response.status} ${response.statusText} for URL: ${feedUrl}`);
	}

	const xml = await response.text();
	const items = [...xml.matchAll(ITEM_RE)].map((match) => match[1]);

	if (items.length === 0) {
		throw new Error(`Podcast feed contained no items: ${feedUrl}`);
	}

	const matched = items.find((item) => {
		const link = text(item, 'link') || '';
		const guid = text(item, 'guid') || '';
		return link.includes(slug) || guid.includes(slug);
	});

	if (!matched) {
		throw new Error(`No feed item matched slug "${slug}" — the feed may not have caught up with the post yet`);
	}

	const enclosure = toEnclosure(matched);

	if (!enclosure) {
		throw new Error(`No audio enclosure in the podcast feed for "${slug}" — check the episode was published with a media file attached`);
	}

	console.log(`Resolved audio for ${slug}: ${enclosure.url} (${enclosure.length} bytes, ${enclosure.declaredType})`);

	return enclosure;
};
