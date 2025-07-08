export const getCountFromKV = async (category: 'fr' | 'jk', env: Env) => {
	try {
		const countStr = await env.MHMIC_TELEGRAM_BOT.get(category);

		if (countStr === null) {
			await env.MHMIC_TELEGRAM_BOT.put(category, '0');
			return parseInt('0');
		}

		const count = parseInt(countStr);

		return count;
	} catch (e: any) {
		return parseInt('0');
	}
};

export const updateKVCount = async (category: 'fr' | 'jk', count: number, env: Env) => {
	try {
		await env.MHMIC_TELEGRAM_BOT.put(category, count.toString());
		return new Response(`count: ${count}`, { status: 200 });
	} catch (e: any) {
		return new Response(e.message, { status: 500 });
	}
};
