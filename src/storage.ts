export const getCountFromKV = async (category: 'fr' | 'jk', env: Env) => {
	try {
		console.log(`Fetching count from KV for category: ${category}`);
		const countStr = await env.MHMIC_TELEGRAM_BOT.get(category);

		if (countStr === null) {
			console.log(`No count found for ${category}, initializing to 0`);
			await env.MHMIC_TELEGRAM_BOT.put(category, '0');
			return parseInt('0');
		}

		const count = parseInt(countStr);
		console.log(`Successfully fetched count from KV for ${category}: ${count}`);
		return count;
	} catch (error) {
		console.error(`Error fetching count from KV for category ${category}:`, error);
		return parseInt('0');
	}
};

export const updateKVCount = async (category: 'fr' | 'jk', count: number, env: Env) => {
	try {
		console.log(`Updating KV count for ${category} to: ${count}`);
		await env.MHMIC_TELEGRAM_BOT.put(category, count.toString());
		console.log(`Successfully updated KV count for ${category}`);
		return new Response(`count: ${count}`, { status: 200 });
	} catch (error) {
		console.error(`Error updating KV count for category ${category}:`, error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		return new Response(errorMessage, { status: 500 });
	}
};
